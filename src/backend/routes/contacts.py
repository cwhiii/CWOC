"""Contact API routes for the CWOC backend.

Provides endpoints for contact CRUD, image upload/delete, favorite toggle,
import/export (vCard and CSV), and helper functions for DB serialization.
"""

import logging
import os
import re
import sqlite3
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile, File, Response

from src.backend.db import (
    DB_PATH, CONTACT_IMAGES_DIR, serialize_json_field, deserialize_json_field,
    compute_display_name,
)
from src.backend.models import Contact
from src.backend.serializers import vcard_parse, vcard_print, csv_export, csv_import
from src.backend.routes.audit import insert_audit_entry, compute_audit_diff, get_actor_from_request


logger = logging.getLogger(__name__)
router = APIRouter()

# Directory for .vcf file storage
CONTACTS_DIR = "/app/data/contacts/"
os.makedirs(CONTACTS_DIR, exist_ok=True)


# ── Contact DB helpers ────────────────────────────────────────────────────

def _serialize_contact_for_db(contact) -> dict:
    """Extract contact fields into a dict ready for SQLite insertion.
    Handles both Pydantic models and plain dicts.
    """
    def _get(field, default=None):
        if isinstance(contact, dict):
            return contact.get(field, default)
        return getattr(contact, field, default)

    # Convert MultiValueEntry lists to list-of-dicts for JSON serialization
    def _mv_to_dicts(entries):
        if not entries:
            return None
        result = []
        for e in entries:
            if isinstance(e, dict):
                result.append(e)
            else:
                result.append(e.dict())
        return result if result else None

    return {
        "given_name": _get("given_name"),
        "surname": _get("surname"),
        "middle_names": _get("middle_names"),
        "prefix": _get("prefix"),
        "suffix": _get("suffix"),
        "nickname": _get("nickname"),
        "display_name": compute_display_name(contact),
        "phones": serialize_json_field(_mv_to_dicts(_get("phones"))),
        "emails": serialize_json_field(_mv_to_dicts(_get("emails"))),
        "addresses": serialize_json_field(_mv_to_dicts(_get("addresses"))),
        "call_signs": serialize_json_field(_mv_to_dicts(_get("call_signs"))),
        "x_handles": serialize_json_field(_mv_to_dicts(_get("x_handles"))),
        "websites": serialize_json_field(_mv_to_dicts(_get("websites"))),
        "dates": serialize_json_field(_mv_to_dicts(_get("dates"))),
        "has_signal": 1 if _get("has_signal") else 0,
        "signal_username": _get("signal_username"),
        "pgp_key": _get("pgp_key"),
        "favorite": 1 if _get("favorite") else 0,
        "color": _get("color"),
        "organization": _get("organization"),
        "social_context": _get("social_context"),
        "image_url": _get("image_url"),
        "notes": _get("notes"),
        "tags": serialize_json_field(_get("tags")),
    }


def _row_to_contact(row: dict) -> dict:
    """Convert a SQLite row dict into a Contact-compatible JSON dict."""
    row["phones"] = deserialize_json_field(row.get("phones"))
    row["emails"] = deserialize_json_field(row.get("emails"))
    row["addresses"] = deserialize_json_field(row.get("addresses"))
    row["call_signs"] = deserialize_json_field(row.get("call_signs"))
    row["x_handles"] = deserialize_json_field(row.get("x_handles"))
    row["websites"] = deserialize_json_field(row.get("websites"))
    row["dates"] = deserialize_json_field(row.get("dates"))
    row["has_signal"] = bool(row.get("has_signal"))
    row["favorite"] = bool(row.get("favorite"))
    row.setdefault("nickname", None)
    row.setdefault("signal_username", None)
    row.setdefault("color", None)
    row.setdefault("organization", None)
    row.setdefault("social_context", None)
    row.setdefault("image_url", None)
    row.setdefault("notes", None)
    row.setdefault("dates", None)
    row["tags"] = deserialize_json_field(row.get("tags"))
    return row


def _write_vcf_file(contact_id: str, contact) -> None:
    """Write a .vcf file for the given contact to CONTACTS_DIR."""
    vcf_content = vcard_print(contact)
    filepath = os.path.join(CONTACTS_DIR, f"{contact_id}.vcf")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(vcf_content)


# ── Route handlers ────────────────────────────────────────────────────────

@router.post("/api/contacts")
def create_contact(contact: Contact, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        contact_id = str(uuid4())
        current_time = datetime.now().isoformat()
        display_name = compute_display_name(contact)

        # Build a dict for vcard_print that includes all fields
        contact_dict = contact.dict()
        contact_dict["id"] = contact_id
        contact_dict["display_name"] = display_name
        contact_dict["created_datetime"] = current_time
        contact_dict["modified_datetime"] = current_time
        contact_dict["owner_id"] = user_id

        # Write .vcf file
        _write_vcf_file(contact_id, contact_dict)

        # Insert SQLite row
        db_fields = _serialize_contact_for_db(contact)
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO contacts (
                id, given_name, surname, middle_names, prefix, suffix,
                nickname, display_name, phones, emails, addresses, call_signs,
                x_handles, websites, dates, has_signal, signal_username, pgp_key, favorite,
                color, organization, social_context, image_url, notes, tags,
                created_datetime, modified_datetime, owner_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                contact_id,
                db_fields["given_name"],
                db_fields["surname"],
                db_fields["middle_names"],
                db_fields["prefix"],
                db_fields["suffix"],
                db_fields["nickname"],
                db_fields["display_name"],
                db_fields["phones"],
                db_fields["emails"],
                db_fields["addresses"],
                db_fields["call_signs"],
                db_fields["x_handles"],
                db_fields["websites"],
                db_fields["dates"],
                db_fields["has_signal"],
                db_fields["signal_username"],
                db_fields["pgp_key"],
                db_fields["favorite"],
                db_fields["color"],
                db_fields["organization"],
                db_fields["social_context"],
                db_fields["image_url"],
                db_fields["notes"],
                db_fields["tags"],
                current_time,
                current_time,
                user_id,
            ),
        )
        # Audit logging for contact creation
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(conn, "contact", contact_id, "created", actor, entity_summary=display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact creation (best-effort): {str(e)}")
        conn.commit()
        return contact_dict
    except Exception as e:
        logger.error(f"Error creating contact: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/contacts")
def get_contacts(request: Request, q: Optional[str] = Query(None)):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        if q:
            like_pattern = f"%{q}%"
            cursor.execute(
                """
                SELECT * FROM contacts
                WHERE owner_id = ?
                  AND (display_name LIKE ? COLLATE NOCASE
                   OR given_name LIKE ? COLLATE NOCASE
                   OR surname LIKE ? COLLATE NOCASE
                   OR nickname LIKE ? COLLATE NOCASE
                   OR organization LIKE ? COLLATE NOCASE
                   OR social_context LIKE ? COLLATE NOCASE
                   OR emails LIKE ? COLLATE NOCASE
                   OR phones LIKE ? COLLATE NOCASE
                   OR addresses LIKE ? COLLATE NOCASE
                   OR call_signs LIKE ? COLLATE NOCASE
                   OR x_handles LIKE ? COLLATE NOCASE
                   OR websites LIKE ? COLLATE NOCASE
                   OR dates LIKE ? COLLATE NOCASE
                   OR notes LIKE ? COLLATE NOCASE
                   OR tags LIKE ? COLLATE NOCASE)
                ORDER BY favorite DESC, display_name COLLATE NOCASE ASC
                """,
                (user_id, like_pattern, like_pattern, like_pattern, like_pattern,
                 like_pattern, like_pattern, like_pattern, like_pattern, like_pattern,
                 like_pattern, like_pattern, like_pattern, like_pattern, like_pattern,
                 like_pattern),
            )
        else:
            cursor.execute(
                "SELECT * FROM contacts WHERE owner_id = ? ORDER BY favorite DESC, display_name COLLATE NOCASE ASC",
                (user_id,),
            )

        columns = [col[0] for col in cursor.description]
        contacts = []
        for row in cursor.fetchall():
            contact = dict(zip(columns, row))
            contacts.append(_row_to_contact(contact))
        return contacts
    except Exception as e:
        logger.error(f"Error fetching contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch contacts: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/contacts/export")
def export_contacts(request: Request, format: str = Query(...)):
    """Export all contacts as a .vcf or .csv file download."""
    if format not in ("vcf", "csv"):
        raise HTTPException(status_code=400, detail="Invalid format. Use 'vcf' or 'csv'")

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM contacts WHERE owner_id = ? ORDER BY favorite DESC, display_name COLLATE NOCASE ASC",
            (user_id,),
        )
        columns = [col[0] for col in cursor.description]
        contacts = []
        for row in cursor.fetchall():
            contact = dict(zip(columns, row))
            contacts.append(_row_to_contact(contact))

        if format == "vcf":
            vcf_parts = [vcard_print(c) for c in contacts]
            content = "\r\n".join(vcf_parts)
            return Response(
                content=content,
                media_type="text/vcard",
                headers={"Content-Disposition": "attachment; filename=contacts.vcf"},
            )
        else:
            content = csv_export(contacts)
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=contacts.csv"},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting contacts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export contacts: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/contacts/{contact_id}/export")
def export_single_contact(contact_id: str, request: Request, format: str = Query(...)):
    """Export a single contact as a .vcf file download."""
    if format != "vcf":
        raise HTTPException(status_code=400, detail="Invalid format. Use 'vcf'")

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        columns = [col[0] for col in cursor.description]
        contact_raw = dict(zip(columns, row))
        # Verify ownership
        if contact_raw.get("owner_id") and contact_raw["owner_id"] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        contact = _row_to_contact(contact_raw)

        vcf_content = vcard_print(contact)
        display = contact.get("display_name") or contact.get("given_name") or "contact"
        safe_name = re.sub(r'[^\w\s-]', '', display).strip().replace(' ', '_')
        return Response(
            content=vcf_content,
            media_type="text/vcard",
            headers={"Content-Disposition": f"attachment; filename={safe_name}.vcf"},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/api/contacts/{contact_id}")
def get_contact(contact_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        columns = [col[0] for col in cursor.description]
        contact = dict(zip(columns, row))
        # Verify ownership
        if contact.get("owner_id") and contact["owner_id"] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        return _row_to_contact(contact)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/api/contacts/{contact_id}")
def update_contact(contact_id: str, contact: Contact, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        columns = [col[0] for col in cursor.description]
        existing_row = dict(zip(columns, existing))
        # Verify ownership
        if existing_row.get("owner_id") and existing_row["owner_id"] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        current_time = datetime.now().isoformat()
        display_name = compute_display_name(contact)

        contact_dict = contact.dict()
        contact_dict["id"] = contact_id
        contact_dict["display_name"] = display_name
        contact_dict["modified_datetime"] = current_time
        contact_dict["created_datetime"] = existing_row["created_datetime"]
        if contact_dict.get("image_url") is None and existing_row.get("image_url"):
            contact_dict["image_url"] = existing_row["image_url"]

        _write_vcf_file(contact_id, contact_dict)

        old_contact_dict = dict(existing_row)

        db_fields = _serialize_contact_for_db(contact)
        if db_fields.get("image_url") is None and existing_row.get("image_url"):
            db_fields["image_url"] = existing_row["image_url"]
        cursor.execute(
            """
            UPDATE contacts SET
                given_name = ?, surname = ?, middle_names = ?, prefix = ?, suffix = ?,
                nickname = ?, display_name = ?, phones = ?, emails = ?, addresses = ?,
                call_signs = ?, x_handles = ?, websites = ?, dates = ?,
                has_signal = ?, signal_username = ?, pgp_key = ?, favorite = ?,
                color = ?, organization = ?, social_context = ?, image_url = ?,
                notes = ?, tags = ?,
                modified_datetime = ?
            WHERE id = ?
            """,
            (
                db_fields["given_name"], db_fields["surname"], db_fields["middle_names"],
                db_fields["prefix"], db_fields["suffix"], db_fields["nickname"],
                db_fields["display_name"], db_fields["phones"], db_fields["emails"],
                db_fields["addresses"], db_fields["call_signs"], db_fields["x_handles"],
                db_fields["websites"], db_fields["dates"], db_fields["has_signal"], db_fields["signal_username"],
                db_fields["pgp_key"], db_fields["favorite"], db_fields["color"],
                db_fields["organization"], db_fields["social_context"], db_fields["image_url"],
                db_fields["notes"], db_fields["tags"], current_time, contact_id,
            ),
        )
        try:
            new_contact_dict = dict(db_fields)
            new_contact_dict["id"] = contact_id
            new_contact_dict["modified_datetime"] = current_time
            new_contact_dict["created_datetime"] = existing_row["created_datetime"]
            diff = compute_audit_diff(old_contact_dict, new_contact_dict, exclude_fields={"modified_datetime", "created_datetime"})
            if diff:
                actor = get_actor_from_request(request)
                insert_audit_entry(conn, "contact", contact_id, "updated", actor, changes=diff, entity_summary=display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact update (best-effort): {str(e)}")
        conn.commit()
        return contact_dict
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, display_name, owner_id FROM contacts WHERE id = ?", (contact_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        # Verify ownership
        if existing[2] and existing[2] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        contact_display_name = existing[1]

        vcf_path = os.path.join(CONTACTS_DIR, f"{contact_id}.vcf")
        if os.path.exists(vcf_path):
            os.remove(vcf_path)

        cursor.execute("DELETE FROM contacts WHERE id = ?", (contact_id,))
        try:
            actor = get_actor_from_request(request)
            insert_audit_entry(conn, "contact", contact_id, "deleted", actor, entity_summary=contact_display_name)
        except Exception as e:
            logger.error(f"Audit logging failed for contact deletion (best-effort): {str(e)}")
        conn.commit()
        return {"message": f"Contact {contact_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete contact: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/contacts/{contact_id}/image")
async def upload_contact_image(contact_id: str, request: Request, file: UploadFile = File(...)):
    """Upload a profile image for a contact. Stores in data/contacts/profile_pictures/."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id, owner_id FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        # Verify ownership
        if row[1] and row[1] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        allowed = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        if file.content_type not in allowed:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, and WebP images are allowed")

        ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}
        ext = ext_map.get(file.content_type, ".jpg")
        filename = f"{contact_id}{ext}"
        filepath = os.path.join(CONTACT_IMAGES_DIR, filename)

        for old_ext in ext_map.values():
            old_path = os.path.join(CONTACT_IMAGES_DIR, f"{contact_id}{old_ext}")
            if os.path.exists(old_path) and old_path != filepath:
                os.remove(old_path)

        contents = await file.read()
        with open(filepath, "wb") as f:
            f.write(contents)

        image_url = f"/data/contacts/profile_pictures/{filename}"

        cursor.execute("UPDATE contacts SET image_url = ?, modified_datetime = ? WHERE id = ?",
                        (image_url, datetime.now().isoformat(), contact_id))
        conn.commit()
        return {"image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading image for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/api/contacts/{contact_id}/image")
def delete_contact_image(contact_id: str, request: Request):
    """Remove a contact's profile image."""
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT image_url, owner_id FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        # Verify ownership
        if row[1] and row[1] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        image_url = row[0]
        if image_url:
            filepath = os.path.join("/app", image_url.lstrip("/"))
            if os.path.exists(filepath):
                os.remove(filepath)

        cursor.execute("UPDATE contacts SET image_url = NULL, modified_datetime = ? WHERE id = ?",
                        (datetime.now().isoformat(), contact_id))
        conn.commit()
        return {"message": "Image removed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting image for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete image: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.patch("/api/contacts/{contact_id}/favorite")
def toggle_contact_favorite(contact_id: str, request: Request):
    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")

        columns = [col[0] for col in cursor.description]
        contact = dict(zip(columns, row))
        # Verify ownership
        if contact.get("owner_id") and contact["owner_id"] != user_id:
            raise HTTPException(status_code=404, detail=f"Contact {contact_id} not found")
        contact = _row_to_contact(contact)

        new_favorite = not contact["favorite"]
        current_time = datetime.now().isoformat()

        cursor.execute(
            "UPDATE contacts SET favorite = ?, modified_datetime = ? WHERE id = ?",
            (1 if new_favorite else 0, current_time, contact_id),
        )
        conn.commit()

        contact["favorite"] = new_favorite
        contact["modified_datetime"] = current_time

        _write_vcf_file(contact_id, contact)

        return contact
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling favorite for contact {contact_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle favorite: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/api/contacts/import")
async def import_contacts(request: Request, file: UploadFile = File(...)):
    """Import contacts from a .vcf or .csv file upload."""
    user_id = request.state.user_id
    filename = (file.filename or "").lower()
    if not (filename.endswith(".vcf") or filename.endswith(".csv")):
        raise HTTPException(status_code=400, detail="Unsupported file type. Use .vcf or .csv")

    content = (await file.read()).decode("utf-8", errors="replace")
    imported = 0
    skipped = 0
    errors_list: List[Dict[str, Any]] = []

    if filename.endswith(".vcf"):
        vcard_blocks = re.findall(r"(BEGIN:VCARD.*?END:VCARD)", content, re.DOTALL | re.IGNORECASE)
        for idx, block in enumerate(vcard_blocks, start=1):
            conn = None
            try:
                parsed = vcard_parse(block)
                if not parsed.get("given_name"):
                    errors_list.append({"entry": idx, "reason": "Missing given_name"})
                    skipped += 1
                    continue

                contact_id = str(uuid4())
                current_time = datetime.now().isoformat()
                display_name = compute_display_name(parsed)

                contact_dict = dict(parsed)
                contact_dict["id"] = contact_id
                contact_dict["display_name"] = display_name
                contact_dict["created_datetime"] = current_time
                contact_dict["modified_datetime"] = current_time

                _write_vcf_file(contact_id, contact_dict)

                db_fields = _serialize_contact_for_db(contact_dict)
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, dates, has_signal, pgp_key, favorite,
                        created_datetime, modified_datetime, owner_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (contact_id, db_fields["given_name"], db_fields["surname"],
                     db_fields["middle_names"], db_fields["prefix"], db_fields["suffix"],
                     db_fields["display_name"], db_fields["phones"], db_fields["emails"],
                     db_fields["addresses"], db_fields["call_signs"], db_fields["x_handles"],
                     db_fields["websites"], db_fields["dates"], db_fields["has_signal"], db_fields["pgp_key"],
                     db_fields["favorite"], current_time, current_time, user_id),
                )
                conn.commit()
                imported += 1
            except Exception as e:
                errors_list.append({"entry": idx, "reason": str(e)})
                skipped += 1
            finally:
                if conn:
                    conn.close()

    elif filename.endswith(".csv"):
        contacts_parsed, csv_errors = csv_import(content)
        for err in csv_errors:
            errors_list.append({"entry": err["row"], "reason": err["reason"]})
            skipped += 1

        for idx, parsed in enumerate(contacts_parsed):
            conn = None
            try:
                contact_id = str(uuid4())
                current_time = datetime.now().isoformat()
                display_name = compute_display_name(parsed)

                contact_dict = dict(parsed)
                contact_dict["id"] = contact_id
                contact_dict["display_name"] = display_name
                contact_dict["created_datetime"] = current_time
                contact_dict["modified_datetime"] = current_time

                _write_vcf_file(contact_id, contact_dict)

                db_fields = _serialize_contact_for_db(contact_dict)
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO contacts (
                        id, given_name, surname, middle_names, prefix, suffix,
                        display_name, phones, emails, addresses, call_signs,
                        x_handles, websites, dates, has_signal, pgp_key, favorite,
                        created_datetime, modified_datetime, owner_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (contact_id, db_fields["given_name"], db_fields["surname"],
                     db_fields["middle_names"], db_fields["prefix"], db_fields["suffix"],
                     db_fields["display_name"], db_fields["phones"], db_fields["emails"],
                     db_fields["addresses"], db_fields["call_signs"], db_fields["x_handles"],
                     db_fields["websites"], db_fields["dates"], db_fields["has_signal"], db_fields["pgp_key"],
                     db_fields["favorite"], current_time, current_time, user_id),
                )
                conn.commit()
                imported += 1
            except Exception as e:
                errors_list.append({"entry": idx, "reason": str(e)})
                skipped += 1
            finally:
                if conn:
                    conn.close()

    return {"imported": imported, "skipped": skipped, "errors": errors_list}
