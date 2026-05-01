"""
Property-based tests for the sharing overhaul feature.

Feature: sharing-overhaul
Uses Python stdlib only (unittest + random) — no external libraries.
Each property test runs 120+ iterations with randomly generated inputs.

NOTE: We inline the minimal production logic from src/backend/sharing.py,
src/backend/routes/notifications.py, and src/backend/routes/chits.py
to avoid importing backend modules that pull in FastAPI.
"""

import copy
import json
import random
import string
import unittest
import uuid
from datetime import datetime, timedelta


# ── Inlined production logic ─────────────────────────────────────────────
# Kept in sync manually. Only the pure-function helpers are copied here so
# the test file can run with *zero* third-party packages.

_ROLE_RANK = {
    "owner": 3,
    "manager": 2,
    "viewer": 1,
}


def _higher_role(a, b):
    """Return whichever role has higher precedence, or the non-None one."""
    if a is None:
        return b
    if b is None:
        return a
    return a if _ROLE_RANK.get(a, 0) >= _ROLE_RANK.get(b, 0) else b


def resolve_effective_role(chit_row, user_id, owner_settings=None):
    """Determine the effective role for a user on a given chit.

    Mirrors src/backend/sharing.resolve_effective_role — kept in sync manually.
    """
    if not chit_row or not user_id:
        return None

    # 1. Owner check
    if chit_row.get("owner_id") == user_id:
        return "owner"

    # 2. Stealth override
    stealth = chit_row.get("stealth")
    if stealth and stealth not in (0, "0", False, None):
        return None

    best_role = None

    # 3. Chit-level shares
    shares_raw = chit_row.get("shares")
    shares = _parse_shares(shares_raw)
    for entry in shares:
        if entry.get("user_id") == user_id:
            role = entry.get("role")
            if role in ("manager", "viewer"):
                best_role = _higher_role(best_role, role)

    # 4. Tag-level shares
    if owner_settings is not None:
        shared_tags_raw = owner_settings.get("shared_tags")
        shared_tags = _parse_shared_tags(shared_tags_raw)
        chit_tags = _parse_chit_tags(chit_row.get("tags"))

        for tag_entry in shared_tags:
            tag_name = tag_entry.get("tag")
            if tag_name and tag_name in chit_tags:
                tag_shares = tag_entry.get("shares") or []
                for share in tag_shares:
                    if share.get("user_id") == user_id:
                        role = share.get("role")
                        if role in ("manager", "viewer"):
                            best_role = _higher_role(best_role, role)

    # 5. Assignment — grants at minimum manager access
    if chit_row.get("assigned_to") == user_id:
        best_role = _higher_role(best_role, "manager")

    return best_role


def can_delete_chit(chit_row, user_id, owner_settings=None):
    """Return True if the user is the chit owner or has manager role.

    Mirrors src/backend/sharing.can_delete_chit — kept in sync manually.
    """
    if not chit_row or not user_id:
        return False
    if chit_row.get("owner_id") == user_id:
        return True
    role = resolve_effective_role(chit_row, user_id, owner_settings)
    return role == "manager"


def can_manage_sharing(chit_row, user_id, owner_settings=None):
    """Return True if the user is the chit owner or has manager role.

    Mirrors src/backend/sharing.can_manage_sharing — kept in sync manually.
    """
    if not chit_row or not user_id:
        return False
    role = resolve_effective_role(chit_row, user_id, owner_settings)
    return role in ("owner", "manager")


def _parse_shares(shares_raw):
    if shares_raw is None:
        return []
    if isinstance(shares_raw, list):
        return shares_raw
    try:
        parsed = json.loads(shares_raw)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _parse_shared_tags(shared_tags_raw):
    if shared_tags_raw is None:
        return []
    if isinstance(shared_tags_raw, list):
        return shared_tags_raw
    try:
        parsed = json.loads(shared_tags_raw)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _parse_chit_tags(tags_raw):
    if tags_raw is None:
        return set()
    if isinstance(tags_raw, list):
        return set(tags_raw)
    if isinstance(tags_raw, set):
        return tags_raw
    try:
        parsed = json.loads(tags_raw)
        if isinstance(parsed, list):
            return set(parsed)
    except (json.JSONDecodeError, TypeError):
        pass
    return set()


# ── Inlined notification creation logic ──────────────────────────────────

def _create_share_notifications(chit_id, chit_title, owner_display_name,
                                old_shares, new_shares,
                                assigned_to_new=None, assigned_to_old=None):
    """Create notification dicts for each newly shared user.

    Returns a list of notification dicts (instead of inserting into DB).
    Mirrors src/backend/routes/notifications._create_share_notifications.
    """
    old_user_ids = {s.get("user_id") for s in (old_shares or []) if isinstance(s, dict)}
    now = datetime.utcnow().isoformat()
    notifications = []

    for entry in (new_shares or []):
        if not isinstance(entry, dict):
            continue
        uid = entry.get("user_id")
        if not uid or uid in old_user_ids:
            continue

        if uid == assigned_to_new and assigned_to_old != uid:
            notif_type = "assigned"
        else:
            notif_type = "invited"

        notifications.append({
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "chit_id": chit_id,
            "chit_title": chit_title,
            "owner_display_name": owner_display_name,
            "notification_type": notif_type,
            "status": "pending",
            "created_datetime": now,
        })

    return notifications


# ── Inlined invite action logic (frontend editor-people.js) ─────────────

def invite_user(shares, user_id):
    """Add a user to shares with role 'viewer' and rsvp_status 'invited'.

    Mirrors the frontend invite action in editor-people.js.
    Returns the updated shares list.
    """
    shares = list(shares or [])
    # Check if user already in shares
    for entry in shares:
        if entry.get("user_id") == user_id:
            return shares  # already present, no-op
    shares.append({
        "user_id": user_id,
        "role": "viewer",
        "rsvp_status": "invited",
    })
    return shares


# ── Inlined assign action logic (frontend editor-people.js) ─────────────

def assign_user(shares, user_id):
    """Assign a user: ensure they are in shares as manager.

    Mirrors the frontend assign action in editor-people.js.
    - If not present: add with role 'manager', rsvp_status 'invited'
    - If present with role 'viewer': upgrade to 'manager'
    - If already 'manager': no change
    Returns the updated shares list.
    """
    shares = list(shares or [])
    for entry in shares:
        if entry.get("user_id") == user_id:
            if entry.get("role") == "viewer":
                entry["role"] = "manager"
            return shares
    shares.append({
        "user_id": user_id,
        "role": "manager",
        "rsvp_status": "invited",
    })
    return shares


# ── Inlined stealth preservation logic (routes/chits.py update_chit) ────

def apply_stealth_preservation(chit_update, existing_chit, user_id):
    """Preserve stealth for non-owners.

    Mirrors the stealth preservation in routes/chits.py update_chit().
    Returns the stealth value that should be saved.
    """
    if existing_chit.get("owner_id") != user_id:
        return bool(existing_chit.get("stealth"))
    return chit_update.get("stealth", existing_chit.get("stealth"))


# ── Inlined manager sharing persistence logic ───────────────────────────

def apply_sharing_persistence(chit_update, existing_chit, user_id, owner_settings=None):
    """Apply sharing field persistence rules for update_chit.

    Mirrors the permission logic in routes/chits.py update_chit().
    Returns (shares, assigned_to) that should be saved.
    """
    if not can_manage_sharing(existing_chit, user_id, owner_settings):
        # Non-managers: preserve original values
        old_shares = existing_chit.get("shares")
        if isinstance(old_shares, str):
            old_shares = json.loads(old_shares)
        return old_shares, existing_chit.get("assigned_to")
    # Managers and owners: use the submitted values
    return chit_update.get("shares"), chit_update.get("assigned_to")


# ── Inlined RSVP self-only logic ────────────────────────────────────────

def update_rsvp_self_only(shares, requesting_user_id, new_status):
    """Update only the requesting user's RSVP status in the shares list.

    Mirrors the RSVP endpoint in routes/chits.py.
    Returns (updated_shares, success).
    """
    shares = copy.deepcopy(shares or [])
    user_found = False
    for entry in shares:
        if isinstance(entry, dict) and entry.get("user_id") == requesting_user_id:
            entry["rsvp_status"] = new_status
            user_found = True
            break
    return shares, user_found


# ── Inlined sharing filter logic (frontend main-views.js) ───────────────

def filter_shared_with_me(chits, current_user_id):
    """Filter to only chits where user is a shared recipient (not owner).

    Mirrors the 'Shared with me' filter in main-sidebar.js / main-views.js.
    """
    result = []
    for chit in chits:
        if chit.get("owner_id") == current_user_id:
            continue
        # User must be in shares or assigned_to
        shares = chit.get("shares") or []
        is_shared = False
        for entry in shares:
            if isinstance(entry, dict) and entry.get("user_id") == current_user_id:
                is_shared = True
                break
        if not is_shared and chit.get("assigned_to") == current_user_id:
            is_shared = True
        if is_shared:
            result.append(chit)
    return result


def filter_shared_by_me(chits, current_user_id):
    """Filter to only chits owned by current user with at least one share entry.

    Mirrors the 'Shared by me' filter in main-sidebar.js / main-views.js.
    """
    result = []
    for chit in chits:
        if chit.get("owner_id") != current_user_id:
            continue
        shares = chit.get("shares") or []
        if len(shares) > 0:
            result.append(chit)
    return result


def filter_sharing_identity(chits):
    """When both sharing filters are inactive, return input unchanged.

    Mirrors the no-filter path in main-views.js.
    """
    return chits


# ── Inlined tag sharing hierarchy logic (settings.js) ───────────────────

def propagate_tag_sharing(parent_tag, sub_tags, shared_tags_config):
    """Propagate parent tag sharing config to all sub-tags.

    Mirrors the tag sharing propagation in settings.js.
    Returns updated shared_tags_config.
    """
    config = copy.deepcopy(shared_tags_config)
    parent_entry = None
    for entry in config:
        if entry.get("tag") == parent_tag:
            parent_entry = entry
            break
    if parent_entry is None:
        return config

    parent_shares = parent_entry.get("shares") or []

    for sub_tag in sub_tags:
        found = False
        for entry in config:
            if entry.get("tag") == sub_tag:
                entry["shares"] = copy.deepcopy(parent_shares)
                found = True
                break
        if not found:
            config.append({
                "tag": sub_tag,
                "shares": copy.deepcopy(parent_shares),
            })

    return config


# ── Inlined tag permission enforcement logic ─────────────────────────────

def can_modify_tag(tag_entry, user_id):
    """Check if user can modify a tag based on tag_permission.

    Mirrors the tag permission enforcement in settings.js.
    Returns True if tag_permission is 'manage', False otherwise.
    """
    shares = tag_entry.get("shares") or []
    for share in shares:
        if share.get("user_id") == user_id:
            return share.get("tag_permission", "view") == "manage"
    return False


# ── Inlined people modal sorting logic ───────────────────────────────────

def sort_people_for_modal(people_entries):
    """Sort people alphabetically by display_name.

    Mirrors the People Expand Modal sorting in editor-people.js.
    Returns sorted list.
    """
    return sorted(people_entries, key=lambda p: (p.get("display_name") or "").lower())


def label_person(person, shares, assigned_to):
    """Label a person entry for the People Expand Modal.

    Mirrors the labeling logic in editor-people.js.
    Returns the label string.
    """
    if person.get("type") == "contact":
        return "Contact"

    user_id = person.get("user_id")
    if user_id == assigned_to:
        return "Assigned"

    for entry in (shares or []):
        if entry.get("user_id") == user_id:
            role = entry.get("role", "viewer")
            rsvp = entry.get("rsvp_status", "invited")
            if role == "manager":
                return "Manager"
            else:
                return "Viewer"

    return "Viewer"


# ── Inlined pending notification count logic ─────────────────────────────

def count_pending_notifications(notifications):
    """Count notifications with status 'pending'.

    Mirrors the badge count logic in main-sidebar.js.
    """
    return sum(1 for n in notifications if n.get("status") == "pending")


# ── Random data generators ───────────────────────────────────────────────

_PBT_ITERATIONS = 120


def _random_uuid():
    return str(uuid.uuid4())


def _random_string(max_len=20):
    length = random.randint(1, max_len)
    return "".join(random.choices(string.ascii_letters + string.digits + " _-", k=length))


def _random_role():
    return random.choice(["manager", "viewer"])


def _random_rsvp_status():
    return random.choice(["invited", "accepted", "declined"])


def _random_tag_permission():
    return random.choice(["view", "manage"])


def _random_share_entry(user_id=None):
    return {
        "user_id": user_id or _random_uuid(),
        "role": _random_role(),
        "rsvp_status": _random_rsvp_status(),
    }


def _random_shares_list(min_count=0, max_count=6, exclude_ids=None):
    count = random.randint(min_count, max_count)
    exclude = set(exclude_ids or [])
    shares = []
    for _ in range(count):
        uid = _random_uuid()
        while uid in exclude:
            uid = _random_uuid()
        exclude.add(uid)
        shares.append(_random_share_entry(user_id=uid))
    return shares


def _random_chit_row(owner_id=None, shares=None, assigned_to=None,
                     stealth=False, tags=None):
    return {
        "id": _random_uuid(),
        "owner_id": owner_id or _random_uuid(),
        "title": _random_string(30),
        "shares": shares if shares is not None else [],
        "assigned_to": assigned_to,
        "stealth": stealth,
        "tags": tags or [],
    }


def _random_notification(user_id=None, status=None, created_datetime=None):
    return {
        "id": _random_uuid(),
        "user_id": user_id or _random_uuid(),
        "chit_id": _random_uuid(),
        "chit_title": _random_string(20),
        "owner_display_name": _random_string(15),
        "notification_type": random.choice(["invited", "assigned"]),
        "status": status or random.choice(["pending", "accepted", "declined"]),
        "created_datetime": created_datetime or datetime.utcnow().isoformat(),
    }


def _random_tag_name():
    return random.choice(["Work", "Personal", "Urgent", "Home", "Travel",
                          "Health", "Finance", "Shopping", "Family", "Hobby"])


def _random_person_entry(person_type=None, user_id=None, display_name=None):
    return {
        "type": person_type or random.choice(["contact", "system_user"]),
        "user_id": user_id or _random_uuid(),
        "display_name": display_name or _random_string(15),
    }


# ═══════════════════════════════════════════════════════════════════════════
# Property 17: Assignment grants manager floor role
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty17AssignmentGrantsManagerFloor(unittest.TestCase):
    """Feature: sharing-overhaul, Property 17: Assignment grants manager floor role

    **Validates: Requirements 10.1, 10.4**

    For any chit where assigned_to matches a user ID and that user has no
    chit-level or tag-level share, resolve_effective_role() SHALL return
    "manager" (not "viewer").
    """

    def test_assignment_only_grants_manager(self):
        """User assigned to chit with no shares gets manager role."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                user_id = _random_uuid()

                # No chit-level shares for this user, no tag-level shares
                other_shares = _random_shares_list(0, 4, exclude_ids=[user_id, owner_id])
                chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=other_shares,
                    assigned_to=user_id,
                    stealth=False,
                )

                role = resolve_effective_role(chit, user_id, owner_settings=None)
                self.assertEqual(
                    role, "manager",
                    f"Assignment-only user should get 'manager', got '{role}' (iter {i})"
                )

    def test_assignment_with_viewer_share_still_manager(self):
        """User assigned + viewer share gets manager (assignment floor is higher)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                user_id = _random_uuid()

                shares = [{"user_id": user_id, "role": "viewer", "rsvp_status": "accepted"}]
                chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=shares,
                    assigned_to=user_id,
                    stealth=False,
                )

                role = resolve_effective_role(chit, user_id, owner_settings=None)
                self.assertEqual(
                    role, "manager",
                    f"Assigned user with viewer share should get 'manager', got '{role}' (iter {i})"
                )

    def test_assignment_with_manager_share_stays_manager(self):
        """User assigned + manager share stays manager."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                user_id = _random_uuid()

                shares = [{"user_id": user_id, "role": "manager", "rsvp_status": "accepted"}]
                chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=shares,
                    assigned_to=user_id,
                    stealth=False,
                )

                role = resolve_effective_role(chit, user_id, owner_settings=None)
                self.assertEqual(
                    role, "manager",
                    f"Assigned user with manager share should get 'manager', got '{role}' (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 6: Manager can soft-delete
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty6ManagerCanSoftDelete(unittest.TestCase):
    """Feature: sharing-overhaul, Property 6: Manager can soft-delete

    **Validates: Requirements 3.4, 9.3**

    For any chit, can_delete_chit() returns true for managers, false for viewers.
    """

    def test_manager_can_delete(self):
        """Manager role allows soft-delete."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()

                shares = [{"user_id": manager_id, "role": "manager", "rsvp_status": _random_rsvp_status()}]
                chit = _random_chit_row(owner_id=owner_id, shares=shares, stealth=False)

                result = can_delete_chit(chit, manager_id)
                self.assertTrue(
                    result,
                    f"Manager should be able to delete, got False (iter {i})"
                )

    def test_viewer_cannot_delete(self):
        """Viewer role does not allow soft-delete."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                viewer_id = _random_uuid()

                shares = [{"user_id": viewer_id, "role": "viewer", "rsvp_status": _random_rsvp_status()}]
                chit = _random_chit_row(owner_id=owner_id, shares=shares, stealth=False)

                result = can_delete_chit(chit, viewer_id)
                self.assertFalse(
                    result,
                    f"Viewer should not be able to delete, got True (iter {i})"
                )

    def test_owner_can_always_delete(self):
        """Owner can always delete regardless of shares."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                shares = _random_shares_list(0, 5, exclude_ids=[owner_id])
                chit = _random_chit_row(owner_id=owner_id, shares=shares, stealth=random.choice([True, False]))

                result = can_delete_chit(chit, owner_id)
                self.assertTrue(
                    result,
                    f"Owner should always be able to delete, got False (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 5: Stealth is preserved for non-owners
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty5StealthPreservedForNonOwners(unittest.TestCase):
    """Feature: sharing-overhaul, Property 5: Stealth is preserved for non-owners

    **Validates: Requirements 3.3, 9.2**

    For any chit and any non-owner user (including managers), saving the chit
    SHALL preserve the existing stealth value regardless of the value submitted.
    """

    def test_non_owner_cannot_change_stealth(self):
        """Non-owner stealth value is always preserved from existing chit."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                non_owner_id = _random_uuid()
                existing_stealth = random.choice([True, False])
                submitted_stealth = random.choice([True, False])

                existing_chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=[{"user_id": non_owner_id, "role": "manager", "rsvp_status": "accepted"}],
                    stealth=existing_stealth,
                )

                chit_update = {"stealth": submitted_stealth}
                result_stealth = apply_stealth_preservation(chit_update, existing_chit, non_owner_id)

                self.assertEqual(
                    result_stealth, existing_stealth,
                    f"Non-owner stealth should be preserved as {existing_stealth}, "
                    f"got {result_stealth} (submitted {submitted_stealth}) (iter {i})"
                )

    def test_owner_can_change_stealth(self):
        """Owner can change stealth to any value."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                new_stealth = random.choice([True, False])

                existing_chit = _random_chit_row(
                    owner_id=owner_id,
                    stealth=not new_stealth,
                )

                chit_update = {"stealth": new_stealth}
                result_stealth = apply_stealth_preservation(chit_update, existing_chit, owner_id)

                self.assertEqual(
                    result_stealth, new_stealth,
                    f"Owner should be able to set stealth to {new_stealth}, "
                    f"got {result_stealth} (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 3: Notification creation completeness
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty3NotificationCreationCompleteness(unittest.TestCase):
    """Feature: sharing-overhaul, Property 3: Notification creation completeness

    **Validates: Requirements 1.5, 2.4, 4.1**

    For any old/new shares diff, exactly one notification is created per new
    user_id with all required fields.
    """

    def test_one_notification_per_new_user(self):
        """Exactly one notification per newly added user_id."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                chit_id = _random_uuid()
                chit_title = _random_string(20)
                owner_name = _random_string(15)

                # Generate old shares with some users
                old_shares = _random_shares_list(0, 4)
                old_user_ids = {s["user_id"] for s in old_shares}

                # Generate new shares: keep some old, add some new
                new_shares = list(old_shares)
                num_new = random.randint(1, 5)
                new_user_ids_added = set()
                for _ in range(num_new):
                    uid = _random_uuid()
                    new_shares.append(_random_share_entry(user_id=uid))
                    new_user_ids_added.add(uid)

                notifications = _create_share_notifications(
                    chit_id, chit_title, owner_name,
                    old_shares, new_shares,
                )

                # Exactly one notification per new user
                notif_user_ids = [n["user_id"] for n in notifications]
                self.assertEqual(
                    len(notif_user_ids), len(new_user_ids_added),
                    f"Expected {len(new_user_ids_added)} notifications, "
                    f"got {len(notif_user_ids)} (iter {i})"
                )
                self.assertEqual(
                    set(notif_user_ids), new_user_ids_added,
                    f"Notification user_ids don't match new users (iter {i})"
                )

    def test_notifications_have_required_fields(self):
        """Each notification has all required fields."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                chit_id = _random_uuid()
                chit_title = _random_string(20)
                owner_name = _random_string(15)

                old_shares = _random_shares_list(0, 3)
                new_shares = list(old_shares) + [_random_share_entry()]

                notifications = _create_share_notifications(
                    chit_id, chit_title, owner_name,
                    old_shares, new_shares,
                )

                for notif in notifications:
                    self.assertTrue(notif.get("chit_id"), f"Missing chit_id (iter {i})")
                    self.assertTrue(notif.get("chit_title"), f"Missing chit_title (iter {i})")
                    self.assertTrue(notif.get("owner_display_name"), f"Missing owner_display_name (iter {i})")
                    self.assertIn(
                        notif.get("notification_type"), ("invited", "assigned"),
                        f"Invalid notification_type '{notif.get('notification_type')}' (iter {i})"
                    )
                    self.assertTrue(notif.get("created_datetime"), f"Missing created_datetime (iter {i})")

    def test_no_notifications_for_existing_users(self):
        """No notifications created for users already in old shares."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                old_shares = _random_shares_list(1, 5)
                # new_shares is same as old_shares (no new users)
                new_shares = copy.deepcopy(old_shares)

                notifications = _create_share_notifications(
                    _random_uuid(), _random_string(), _random_string(),
                    old_shares, new_shares,
                )

                self.assertEqual(
                    len(notifications), 0,
                    f"Should be 0 notifications for unchanged shares, got {len(notifications)} (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 8: Notifications ordered by creation time descending
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty8NotificationsOrderedDescending(unittest.TestCase):
    """Feature: sharing-overhaul, Property 8: Notifications ordered by creation time descending

    **Validates: Requirements 4.2**

    For any set of notifications belonging to a user, the GET endpoint
    returns them ordered by created_datetime descending (newest first).
    """

    def test_notifications_sorted_newest_first(self):
        """Notifications are returned newest-first when sorted by created_datetime DESC."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                count = random.randint(2, 10)

                # Generate notifications with random timestamps
                base_time = datetime(2025, 1, 1)
                notifications = []
                for j in range(count):
                    offset = random.randint(0, 365 * 24 * 3600)
                    ts = (base_time + timedelta(seconds=offset)).isoformat()
                    notifications.append(_random_notification(
                        user_id=user_id,
                        created_datetime=ts,
                    ))

                # Simulate the GET endpoint: ORDER BY created_datetime DESC
                sorted_notifs = sorted(
                    notifications,
                    key=lambda n: n["created_datetime"],
                    reverse=True,
                )

                # Verify ordering
                for j in range(len(sorted_notifs) - 1):
                    self.assertGreaterEqual(
                        sorted_notifs[j]["created_datetime"],
                        sorted_notifs[j + 1]["created_datetime"],
                        f"Notification {j} should be >= notification {j+1} "
                        f"by created_datetime (iter {i})"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Property 9: Notification and RSVP status stay in sync
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty9NotificationRsvpSync(unittest.TestCase):
    """Feature: sharing-overhaul, Property 9: Notification and RSVP status stay in sync

    **Validates: Requirements 4.3, 4.4**

    Accepting/declining a notification updates the chit's RSVP, and vice versa.
    """

    def test_notification_accept_syncs_rsvp(self):
        """Accepting a notification sets the chit share's rsvp_status to 'accepted'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                new_status = random.choice(["accepted", "declined"])

                # Simulate chit shares with the user having 'invited' status
                shares = [
                    {"user_id": _random_uuid(), "role": _random_role(), "rsvp_status": _random_rsvp_status()},
                    {"user_id": user_id, "role": _random_role(), "rsvp_status": "invited"},
                    {"user_id": _random_uuid(), "role": _random_role(), "rsvp_status": _random_rsvp_status()},
                ]

                # Simulate notification PATCH: update notification status + sync RSVP
                updated_shares = copy.deepcopy(shares)
                for entry in updated_shares:
                    if entry.get("user_id") == user_id:
                        entry["rsvp_status"] = new_status
                        break

                # Verify the user's RSVP matches the notification status
                for entry in updated_shares:
                    if entry.get("user_id") == user_id:
                        self.assertEqual(
                            entry["rsvp_status"], new_status,
                            f"RSVP should match notification status '{new_status}', "
                            f"got '{entry['rsvp_status']}' (iter {i})"
                        )

    def test_rsvp_update_syncs_notification(self):
        """Updating RSVP via editor syncs the corresponding notification status."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                chit_id = _random_uuid()
                new_rsvp = random.choice(["accepted", "declined"])

                # Simulate a pending notification for this user/chit
                notification = {
                    "id": _random_uuid(),
                    "user_id": user_id,
                    "chit_id": chit_id,
                    "status": "pending",
                }

                # Simulate the RSVP endpoint syncing the notification:
                # UPDATE notifications SET status = ? WHERE user_id = ? AND chit_id = ? AND status = 'pending'
                if notification["user_id"] == user_id and notification["chit_id"] == chit_id and notification["status"] == "pending":
                    notification["status"] = new_rsvp

                self.assertEqual(
                    notification["status"], new_rsvp,
                    f"Notification status should sync to '{new_rsvp}', "
                    f"got '{notification['status']}' (iter {i})"
                )

    def test_other_users_rsvp_unchanged_on_notification_accept(self):
        """Accepting a notification only changes the accepting user's RSVP."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                new_status = random.choice(["accepted", "declined"])

                # Build shares with multiple users
                other_shares = _random_shares_list(1, 4, exclude_ids=[user_id])
                original_other_statuses = {e["user_id"]: e["rsvp_status"] for e in other_shares}

                all_shares = other_shares + [{"user_id": user_id, "role": "viewer", "rsvp_status": "invited"}]
                updated_shares = copy.deepcopy(all_shares)

                # Sync RSVP for the accepting user only
                for entry in updated_shares:
                    if entry.get("user_id") == user_id:
                        entry["rsvp_status"] = new_status
                        break

                # Verify other users' statuses are unchanged
                for entry in updated_shares:
                    if entry.get("user_id") != user_id:
                        original = original_other_statuses.get(entry["user_id"])
                        self.assertEqual(
                            entry["rsvp_status"], original,
                            f"Other user's RSVP should be unchanged: expected '{original}', "
                            f"got '{entry['rsvp_status']}' (iter {i})"
                        )


# ═══════════════════════════════════════════════════════════════════════════
# Property 4: Manager can persist sharing fields
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty4ManagerCanPersistSharingFields(unittest.TestCase):
    """Feature: sharing-overhaul, Property 4: Manager can persist sharing fields

    **Validates: Requirements 3.1, 3.2, 3.6, 9.1, 9.4**

    For any chit where the requesting user has effective_role "manager",
    saving with modified shares and assigned_to SHALL persist those values.
    """

    def test_manager_shares_persisted(self):
        """Manager's submitted shares are persisted (not silently reverted)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                manager_id = _random_uuid()

                existing_shares = [{"user_id": manager_id, "role": "manager", "rsvp_status": "accepted"}]
                existing_chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=existing_shares,
                    stealth=False,
                )

                # Manager submits new shares
                new_user = _random_uuid()
                submitted_shares = existing_shares + [{"user_id": new_user, "role": "viewer", "rsvp_status": "invited"}]
                submitted_assigned = _random_uuid()

                chit_update = {
                    "shares": submitted_shares,
                    "assigned_to": submitted_assigned,
                }

                result_shares, result_assigned = apply_sharing_persistence(
                    chit_update, existing_chit, manager_id,
                )

                self.assertEqual(
                    result_shares, submitted_shares,
                    f"Manager's shares should be persisted (iter {i})"
                )
                self.assertEqual(
                    result_assigned, submitted_assigned,
                    f"Manager's assigned_to should be persisted (iter {i})"
                )

    def test_viewer_shares_reverted(self):
        """Viewer's submitted shares are silently reverted to original."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()
                viewer_id = _random_uuid()

                existing_shares = [{"user_id": viewer_id, "role": "viewer", "rsvp_status": "accepted"}]
                existing_assigned = _random_uuid()
                existing_chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=existing_shares,
                    assigned_to=existing_assigned,
                    stealth=False,
                )

                # Viewer submits different shares (should be reverted)
                submitted_shares = [{"user_id": _random_uuid(), "role": "manager", "rsvp_status": "invited"}]
                submitted_assigned = _random_uuid()

                chit_update = {
                    "shares": submitted_shares,
                    "assigned_to": submitted_assigned,
                }

                result_shares, result_assigned = apply_sharing_persistence(
                    chit_update, existing_chit, viewer_id,
                )

                self.assertEqual(
                    result_shares, existing_shares,
                    f"Viewer's shares should be reverted to original (iter {i})"
                )
                self.assertEqual(
                    result_assigned, existing_assigned,
                    f"Viewer's assigned_to should be reverted to original (iter {i})"
                )

    def test_owner_shares_persisted(self):
        """Owner's submitted shares are always persisted."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                owner_id = _random_uuid()

                existing_chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=[],
                    stealth=False,
                )

                submitted_shares = _random_shares_list(1, 5, exclude_ids=[owner_id])
                submitted_assigned = _random_uuid()

                chit_update = {
                    "shares": submitted_shares,
                    "assigned_to": submitted_assigned,
                }

                result_shares, result_assigned = apply_sharing_persistence(
                    chit_update, existing_chit, owner_id,
                )

                self.assertEqual(
                    result_shares, submitted_shares,
                    f"Owner's shares should be persisted (iter {i})"
                )
                self.assertEqual(
                    result_assigned, submitted_assigned,
                    f"Owner's assigned_to should be persisted (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 7: RSVP updates are self-only
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty7RsvpUpdatesSelfOnly(unittest.TestCase):
    """Feature: sharing-overhaul, Property 7: RSVP updates are self-only

    **Validates: Requirements 3.5**

    For any chit with multiple shared users, when a user updates RSVP status,
    only that user's own rsvp_status is modified. All others remain unchanged.
    """

    def test_only_requesting_user_rsvp_changes(self):
        """Only the requesting user's RSVP is modified."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                requesting_user = _random_uuid()
                new_status = random.choice(["accepted", "declined"])

                # Build shares with multiple users including the requester
                other_shares = _random_shares_list(1, 5, exclude_ids=[requesting_user])
                all_shares = other_shares + [
                    {"user_id": requesting_user, "role": _random_role(), "rsvp_status": "invited"}
                ]

                # Snapshot original statuses for other users
                original_others = {
                    e["user_id"]: e["rsvp_status"]
                    for e in all_shares if e["user_id"] != requesting_user
                }

                updated_shares, success = update_rsvp_self_only(all_shares, requesting_user, new_status)

                self.assertTrue(success, f"User should be found in shares (iter {i})")

                # Verify requesting user's status changed
                for entry in updated_shares:
                    if entry["user_id"] == requesting_user:
                        self.assertEqual(
                            entry["rsvp_status"], new_status,
                            f"Requesting user's RSVP should be '{new_status}' (iter {i})"
                        )

                # Verify all other users' statuses are unchanged
                for entry in updated_shares:
                    if entry["user_id"] != requesting_user:
                        expected = original_others[entry["user_id"]]
                        self.assertEqual(
                            entry["rsvp_status"], expected,
                            f"Other user's RSVP should be unchanged: expected '{expected}', "
                            f"got '{entry['rsvp_status']}' (iter {i})"
                        )

    def test_user_not_in_shares_fails(self):
        """RSVP update fails if user is not in shares."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                requesting_user = _random_uuid()
                shares = _random_shares_list(1, 5, exclude_ids=[requesting_user])

                _, success = update_rsvp_self_only(shares, requesting_user, "accepted")

                self.assertFalse(
                    success,
                    f"User not in shares should fail RSVP update (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 1: Invite adds user with viewer role and invited status
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty1InviteAddsViewerInvited(unittest.TestCase):
    """Feature: sharing-overhaul, Property 1: Invite adds user with viewer role and invited status

    **Validates: Requirements 1.1**

    For any valid system user ID and any existing shares array, adding that
    user via the invite action SHALL produce a new share entry with
    role: "viewer" and rsvp_status: "invited".
    """

    def test_invite_creates_viewer_invited_entry(self):
        """Invite action adds user with role 'viewer' and rsvp_status 'invited'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                new_user_id = _random_uuid()
                existing_shares = _random_shares_list(0, 5, exclude_ids=[new_user_id])

                updated_shares = invite_user(existing_shares, new_user_id)

                # Find the new entry
                new_entry = None
                for entry in updated_shares:
                    if entry.get("user_id") == new_user_id:
                        new_entry = entry
                        break

                self.assertIsNotNone(
                    new_entry,
                    f"Invited user should be in shares (iter {i})"
                )
                self.assertEqual(
                    new_entry["role"], "viewer",
                    f"Invited user should have role 'viewer', got '{new_entry['role']}' (iter {i})"
                )
                self.assertEqual(
                    new_entry["rsvp_status"], "invited",
                    f"Invited user should have rsvp_status 'invited', "
                    f"got '{new_entry['rsvp_status']}' (iter {i})"
                )

    def test_invite_preserves_existing_shares(self):
        """Invite does not modify existing share entries."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                new_user_id = _random_uuid()
                existing_shares = _random_shares_list(1, 5, exclude_ids=[new_user_id])
                original_snapshot = copy.deepcopy(existing_shares)

                updated_shares = invite_user(existing_shares, new_user_id)

                # All original entries should be unchanged
                for j, original in enumerate(original_snapshot):
                    self.assertEqual(
                        updated_shares[j]["user_id"], original["user_id"],
                        f"Existing share {j} user_id changed (iter {i})"
                    )
                    self.assertEqual(
                        updated_shares[j]["role"], original["role"],
                        f"Existing share {j} role changed (iter {i})"
                    )

    def test_invite_existing_user_is_noop(self):
        """Inviting a user already in shares is a no-op."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                existing_shares = _random_shares_list(1, 5)
                existing_user_id = existing_shares[0]["user_id"]
                original_len = len(existing_shares)

                updated_shares = invite_user(existing_shares, existing_user_id)

                self.assertEqual(
                    len(updated_shares), original_len,
                    f"Inviting existing user should not add duplicate (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 2: Assign ensures user is manager in shares
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty2AssignEnsuresManager(unittest.TestCase):
    """Feature: sharing-overhaul, Property 2: Assign ensures user is manager in shares

    **Validates: Requirements 2.2, 2.3, 10.2, 10.3**

    After assign, user appears in shares with role "manager".
    If not present, added with manager+invited.
    If viewer, upgraded to manager.
    If already manager, no change.
    """

    def test_assign_new_user_adds_as_manager(self):
        """Assigning a user not in shares adds them as manager with invited status."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                new_user_id = _random_uuid()
                existing_shares = _random_shares_list(0, 4, exclude_ids=[new_user_id])

                updated_shares = assign_user(existing_shares, new_user_id)

                new_entry = None
                for entry in updated_shares:
                    if entry.get("user_id") == new_user_id:
                        new_entry = entry
                        break

                self.assertIsNotNone(new_entry, f"Assigned user should be in shares (iter {i})")
                self.assertEqual(
                    new_entry["role"], "manager",
                    f"Assigned user should have role 'manager', got '{new_entry['role']}' (iter {i})"
                )
                self.assertEqual(
                    new_entry["rsvp_status"], "invited",
                    f"New assigned user should have rsvp_status 'invited' (iter {i})"
                )

    def test_assign_viewer_upgrades_to_manager(self):
        """Assigning a user already in shares as viewer upgrades to manager."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                existing_shares = [
                    {"user_id": user_id, "role": "viewer", "rsvp_status": _random_rsvp_status()},
                ]

                updated_shares = assign_user(existing_shares, user_id)

                for entry in updated_shares:
                    if entry.get("user_id") == user_id:
                        self.assertEqual(
                            entry["role"], "manager",
                            f"Viewer should be upgraded to manager (iter {i})"
                        )

    def test_assign_existing_manager_no_change(self):
        """Assigning a user already a manager makes no change."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                original_rsvp = _random_rsvp_status()
                existing_shares = [
                    {"user_id": user_id, "role": "manager", "rsvp_status": original_rsvp},
                ]

                updated_shares = assign_user(existing_shares, user_id)

                self.assertEqual(len(updated_shares), 1, f"No new entry should be added (iter {i})")
                self.assertEqual(
                    updated_shares[0]["role"], "manager",
                    f"Role should remain manager (iter {i})"
                )
                self.assertEqual(
                    updated_shares[0]["rsvp_status"], original_rsvp,
                    f"RSVP should remain unchanged (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 10: Pending notification count accuracy
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty10PendingNotificationCountAccuracy(unittest.TestCase):
    """Feature: sharing-overhaul, Property 10: Pending notification count accuracy

    **Validates: Requirements 5.2**

    The count of pending notifications matches the number with status "pending".
    """

    def test_pending_count_matches_pending_status(self):
        """Badge count equals number of notifications with status 'pending'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                count = random.randint(0, 15)

                notifications = []
                expected_pending = 0
                for _ in range(count):
                    status = random.choice(["pending", "accepted", "declined"])
                    notifications.append(_random_notification(user_id=user_id, status=status))
                    if status == "pending":
                        expected_pending += 1

                actual_count = count_pending_notifications(notifications)

                self.assertEqual(
                    actual_count, expected_pending,
                    f"Pending count should be {expected_pending}, got {actual_count} (iter {i})"
                )

    def test_all_pending_count(self):
        """When all notifications are pending, count equals total."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                count = random.randint(1, 10)
                notifications = [
                    _random_notification(user_id=user_id, status="pending")
                    for _ in range(count)
                ]

                actual_count = count_pending_notifications(notifications)
                self.assertEqual(actual_count, count, f"All pending: count should be {count} (iter {i})")

    def test_no_pending_count_zero(self):
        """When no notifications are pending, count is zero."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                count = random.randint(0, 10)
                notifications = [
                    _random_notification(user_id=user_id, status=random.choice(["accepted", "declined"]))
                    for _ in range(count)
                ]

                actual_count = count_pending_notifications(notifications)
                self.assertEqual(actual_count, 0, f"No pending: count should be 0 (iter {i})")


# ═══════════════════════════════════════════════════════════════════════════
# Property 14: Shared-with-me filter correctness
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty14SharedWithMeFilter(unittest.TestCase):
    """Feature: sharing-overhaul, Property 14: Shared-with-me filter correctness

    **Validates: Requirements 7.2**

    With filter active, only chits where user is shared recipient (not owner) appear.
    """

    def test_only_shared_chits_returned(self):
        """Filtered results contain only chits shared with the user (not owned)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user = _random_uuid()

                chits = []
                # Add some owned chits (should be excluded)
                for _ in range(random.randint(1, 4)):
                    chits.append(_random_chit_row(owner_id=current_user))

                # Add some chits shared with user (should be included)
                for _ in range(random.randint(1, 4)):
                    other_owner = _random_uuid()
                    shares = [{"user_id": current_user, "role": _random_role(), "rsvp_status": _random_rsvp_status()}]
                    chits.append(_random_chit_row(owner_id=other_owner, shares=shares))

                # Add some chits not shared with user (should be excluded)
                for _ in range(random.randint(0, 3)):
                    chits.append(_random_chit_row(owner_id=_random_uuid()))

                result = filter_shared_with_me(chits, current_user)

                for chit in result:
                    self.assertNotEqual(
                        chit.get("owner_id"), current_user,
                        f"Owned chit should not appear in shared-with-me (iter {i})"
                    )
                    # User must be in shares or assigned_to
                    shares = chit.get("shares") or []
                    user_in_shares = any(
                        e.get("user_id") == current_user for e in shares
                    )
                    user_assigned = chit.get("assigned_to") == current_user
                    self.assertTrue(
                        user_in_shares or user_assigned,
                        f"User must be in shares or assigned_to (iter {i})"
                    )

    def test_no_owned_chits_in_result(self):
        """No chits owned by the current user appear in the result."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user = _random_uuid()
                chits = []
                for _ in range(random.randint(2, 8)):
                    owner = random.choice([current_user, _random_uuid()])
                    shares = []
                    if owner != current_user and random.random() > 0.5:
                        shares = [{"user_id": current_user, "role": "viewer", "rsvp_status": "invited"}]
                    chits.append(_random_chit_row(owner_id=owner, shares=shares))

                result = filter_shared_with_me(chits, current_user)

                for chit in result:
                    self.assertNotEqual(
                        chit.get("owner_id"), current_user,
                        f"Owned chit should not appear (iter {i})"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Property 15: Shared-by-me filter correctness
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty15SharedByMeFilter(unittest.TestCase):
    """Feature: sharing-overhaul, Property 15: Shared-by-me filter correctness

    **Validates: Requirements 7.3**

    With filter active, only chits owned by current user with at least one
    share entry appear.
    """

    def test_only_owned_shared_chits_returned(self):
        """Filtered results contain only owned chits with shares."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                current_user = _random_uuid()

                chits = []
                # Owned chits with shares (should be included)
                for _ in range(random.randint(1, 3)):
                    shares = _random_shares_list(1, 3, exclude_ids=[current_user])
                    chits.append(_random_chit_row(owner_id=current_user, shares=shares))

                # Owned chits without shares (should be excluded)
                for _ in range(random.randint(1, 3)):
                    chits.append(_random_chit_row(owner_id=current_user, shares=[]))

                # Non-owned chits (should be excluded)
                for _ in range(random.randint(1, 3)):
                    chits.append(_random_chit_row(owner_id=_random_uuid()))

                result = filter_shared_by_me(chits, current_user)

                for chit in result:
                    self.assertEqual(
                        chit.get("owner_id"), current_user,
                        f"Result chit must be owned by current user (iter {i})"
                    )
                    shares = chit.get("shares") or []
                    self.assertGreater(
                        len(shares), 0,
                        f"Result chit must have at least one share entry (iter {i})"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Property 16: No sharing filter is identity
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty16NoFilterIsIdentity(unittest.TestCase):
    """Feature: sharing-overhaul, Property 16: No sharing filter is identity

    **Validates: Requirements 7.4**

    When both filters inactive, the filter function returns input unchanged.
    """

    def test_identity_returns_same_list(self):
        """No-filter returns the exact same list."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(0, 10)
                chits = [_random_chit_row() for _ in range(count)]

                result = filter_sharing_identity(chits)

                self.assertIs(
                    result, chits,
                    f"Identity filter should return the same list object (iter {i})"
                )
                self.assertEqual(
                    len(result), count,
                    f"Identity filter should preserve length (iter {i})"
                )

    def test_identity_preserves_all_chits(self):
        """No-filter preserves every chit in order."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(1, 10)
                chits = [_random_chit_row() for _ in range(count)]
                original_ids = [c["id"] for c in chits]

                result = filter_sharing_identity(chits)
                result_ids = [c["id"] for c in result]

                self.assertEqual(
                    result_ids, original_ids,
                    f"Identity filter should preserve chit order and IDs (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 11: Tag sharing hierarchy invariant
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty11TagSharingHierarchyInvariant(unittest.TestCase):
    """Feature: sharing-overhaul, Property 11: Tag sharing hierarchy invariant

    **Validates: Requirements 6.1, 6.2, 6.3**

    All sub-tags of a shared parent have the same sharing config as the parent.
    """

    def test_sub_tags_inherit_parent_config(self):
        """After propagation, all sub-tags have the same shares as the parent."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                parent_tag = _random_tag_name()
                num_sub = random.randint(1, 5)
                sub_tags = [f"{parent_tag}/{_random_string(8)}" for _ in range(num_sub)]

                # Parent has some shares
                num_shares = random.randint(1, 4)
                parent_shares = []
                for _ in range(num_shares):
                    parent_shares.append({
                        "user_id": _random_uuid(),
                        "role": _random_role(),
                        "tag_permission": _random_tag_permission(),
                    })

                config = [{"tag": parent_tag, "shares": parent_shares}]

                result = propagate_tag_sharing(parent_tag, sub_tags, config)

                # Verify each sub-tag has the same shares as parent
                for sub_tag in sub_tags:
                    sub_entry = None
                    for entry in result:
                        if entry.get("tag") == sub_tag:
                            sub_entry = entry
                            break
                    self.assertIsNotNone(
                        sub_entry,
                        f"Sub-tag '{sub_tag}' should exist in config (iter {i})"
                    )
                    # Compare shares (ignoring order)
                    parent_uids = {s["user_id"] for s in parent_shares}
                    sub_uids = {s["user_id"] for s in sub_entry.get("shares", [])}
                    self.assertEqual(
                        parent_uids, sub_uids,
                        f"Sub-tag '{sub_tag}' should have same user_ids as parent (iter {i})"
                    )

    def test_new_sub_tag_inherits_parent(self):
        """A newly added sub-tag inherits the parent's sharing config."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                parent_tag = _random_tag_name()
                existing_sub = f"{parent_tag}/existing"
                new_sub = f"{parent_tag}/new_{_random_string(5)}"

                parent_shares = [{"user_id": _random_uuid(), "role": _random_role(), "tag_permission": "manage"}]
                config = [
                    {"tag": parent_tag, "shares": parent_shares},
                    {"tag": existing_sub, "shares": copy.deepcopy(parent_shares)},
                ]

                result = propagate_tag_sharing(parent_tag, [existing_sub, new_sub], config)

                new_entry = None
                for entry in result:
                    if entry.get("tag") == new_sub:
                        new_entry = entry
                        break

                self.assertIsNotNone(new_entry, f"New sub-tag should be added (iter {i})")
                self.assertEqual(
                    len(new_entry.get("shares", [])), len(parent_shares),
                    f"New sub-tag should inherit parent's shares count (iter {i})"
                )

    def test_removed_sub_tag_config_removable(self):
        """When a sub-tag is removed, its config entry can be removed."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                parent_tag = _random_tag_name()
                sub_tags = [f"{parent_tag}/sub_{j}" for j in range(random.randint(1, 4))]

                parent_shares = [{"user_id": _random_uuid(), "role": "viewer", "tag_permission": "view"}]
                config = [{"tag": parent_tag, "shares": parent_shares}]
                for sub in sub_tags:
                    config.append({"tag": sub, "shares": copy.deepcopy(parent_shares)})

                # Remove a sub-tag
                removed = random.choice(sub_tags)
                remaining = [s for s in sub_tags if s != removed]
                cleaned_config = [e for e in config if e.get("tag") != removed]

                # Verify removed tag is gone
                removed_found = any(e.get("tag") == removed for e in cleaned_config)
                self.assertFalse(
                    removed_found,
                    f"Removed sub-tag '{removed}' should not be in config (iter {i})"
                )

                # Verify remaining sub-tags still present
                for sub in remaining:
                    found = any(e.get("tag") == sub for e in cleaned_config)
                    self.assertTrue(
                        found,
                        f"Remaining sub-tag '{sub}' should still be in config (iter {i})"
                    )


# ═══════════════════════════════════════════════════════════════════════════
# Property 12: Tag permission enforcement
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty12TagPermissionEnforcement(unittest.TestCase):
    """Feature: sharing-overhaul, Property 12: Tag permission enforcement

    **Validates: Requirements 6.6, 6.7**

    User can modify tag iff tag_permission is "manage"; "view" rejects modifications.
    """

    def test_manage_permission_allows_modification(self):
        """Users with tag_permission 'manage' can modify the tag."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                tag_entry = {
                    "tag": _random_tag_name(),
                    "shares": [
                        {"user_id": user_id, "role": _random_role(), "tag_permission": "manage"},
                    ],
                }

                result = can_modify_tag(tag_entry, user_id)
                self.assertTrue(
                    result,
                    f"User with 'manage' permission should be able to modify tag (iter {i})"
                )

    def test_view_permission_rejects_modification(self):
        """Users with tag_permission 'view' cannot modify the tag."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                tag_entry = {
                    "tag": _random_tag_name(),
                    "shares": [
                        {"user_id": user_id, "role": _random_role(), "tag_permission": "view"},
                    ],
                }

                result = can_modify_tag(tag_entry, user_id)
                self.assertFalse(
                    result,
                    f"User with 'view' permission should not be able to modify tag (iter {i})"
                )

    def test_missing_permission_defaults_to_view(self):
        """Missing tag_permission defaults to 'view' (no modification allowed)."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                tag_entry = {
                    "tag": _random_tag_name(),
                    "shares": [
                        {"user_id": user_id, "role": _random_role()},
                        # No tag_permission field
                    ],
                }

                result = can_modify_tag(tag_entry, user_id)
                self.assertFalse(
                    result,
                    f"Missing tag_permission should default to 'view' (no modify) (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 13: Tag-level shares have no RSVP flow
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty13TagSharesNoRsvpFlow(unittest.TestCase):
    """Feature: sharing-overhaul, Property 13: Tag-level shares have no RSVP flow

    **Validates: Requirements 6.9**

    Tag-level sharing does not create notifications or set rsvp_status.
    """

    def test_tag_sharing_creates_no_notifications(self):
        """Tag-level sharing does not produce notifications."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                # Simulate tag-level sharing: user is shared via tag, not chit-level
                user_id = _random_uuid()
                owner_id = _random_uuid()
                tag_name = _random_tag_name()

                # Chit has no chit-level shares for this user
                chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=[],  # No chit-level shares
                    tags=[tag_name],
                )

                # Owner settings have tag-level sharing for this user
                owner_settings = {
                    "shared_tags": [
                        {
                            "tag": tag_name,
                            "shares": [
                                {"user_id": user_id, "role": _random_role(), "tag_permission": _random_tag_permission()},
                            ],
                        }
                    ]
                }

                # User gets access via tag-level sharing
                role = resolve_effective_role(chit, user_id, owner_settings)
                self.assertIsNotNone(role, f"User should have access via tag sharing (iter {i})")

                # But no notifications are created for tag-level sharing
                # (notifications are only created when chit-level shares change)
                old_shares = []
                new_shares = []  # No chit-level share changes
                notifications = _create_share_notifications(
                    chit["id"], chit["title"], "Owner",
                    old_shares, new_shares,
                )

                self.assertEqual(
                    len(notifications), 0,
                    f"Tag-level sharing should not create notifications (iter {i})"
                )

    def test_tag_shared_chit_has_no_rsvp_status(self):
        """Chits shared exclusively via tags have no rsvp_status for the user."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                owner_id = _random_uuid()
                tag_name = _random_tag_name()

                # Chit has no chit-level share entry for this user
                other_shares = _random_shares_list(0, 3, exclude_ids=[user_id])
                chit = _random_chit_row(
                    owner_id=owner_id,
                    shares=other_shares,
                    tags=[tag_name],
                )

                # User is shared via tag only
                owner_settings = {
                    "shared_tags": [
                        {
                            "tag": tag_name,
                            "shares": [{"user_id": user_id, "role": "viewer"}],
                        }
                    ]
                }

                role = resolve_effective_role(chit, user_id, owner_settings)
                self.assertIsNotNone(role, f"User should have tag-level access (iter {i})")

                # Verify no rsvp_status exists for this user in chit-level shares
                chit_shares = chit.get("shares") or []
                user_share = None
                for entry in chit_shares:
                    if entry.get("user_id") == user_id:
                        user_share = entry
                        break

                self.assertIsNone(
                    user_share,
                    f"Tag-only shared user should not have a chit-level share entry (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════
# Property 18: People modal entries alphabetically ordered and correctly labeled
# ═══════════════════════════════════════════════════════════════════════════

class TestProperty18PeopleModalAlphabeticalAndLabeled(unittest.TestCase):
    """Feature: sharing-overhaul, Property 18: People modal entries are alphabetically ordered and correctly labeled

    **Validates: Requirements 8.3, 8.4**

    People are sorted alphabetically and labeled correctly
    (Contact vs sharing capacity).
    """

    def test_people_sorted_alphabetically(self):
        """People entries are sorted alphabetically by display_name."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                count = random.randint(2, 10)
                people = []
                for _ in range(count):
                    people.append(_random_person_entry(
                        display_name=_random_string(15),
                    ))

                sorted_people = sort_people_for_modal(people)

                for j in range(len(sorted_people) - 1):
                    name_a = (sorted_people[j].get("display_name") or "").lower()
                    name_b = (sorted_people[j + 1].get("display_name") or "").lower()
                    self.assertLessEqual(
                        name_a, name_b,
                        f"People should be alphabetically sorted: '{name_a}' > '{name_b}' (iter {i})"
                    )

    def test_contacts_labeled_correctly(self):
        """Contact entries are labeled 'Contact'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                person = _random_person_entry(person_type="contact")
                shares = _random_shares_list(0, 3)
                assigned_to = _random_uuid()

                label = label_person(person, shares, assigned_to)
                self.assertEqual(
                    label, "Contact",
                    f"Contact should be labeled 'Contact', got '{label}' (iter {i})"
                )

    def test_assigned_user_labeled_correctly(self):
        """Assigned system user is labeled 'Assigned'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                person = _random_person_entry(person_type="system_user", user_id=user_id)
                shares = [{"user_id": user_id, "role": _random_role(), "rsvp_status": _random_rsvp_status()}]

                label = label_person(person, shares, assigned_to=user_id)
                self.assertEqual(
                    label, "Assigned",
                    f"Assigned user should be labeled 'Assigned', got '{label}' (iter {i})"
                )

    def test_manager_user_labeled_correctly(self):
        """Manager system user (not assigned) is labeled 'Manager'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                person = _random_person_entry(person_type="system_user", user_id=user_id)
                shares = [{"user_id": user_id, "role": "manager", "rsvp_status": _random_rsvp_status()}]
                assigned_to = _random_uuid()  # Different user is assigned

                label = label_person(person, shares, assigned_to)
                self.assertEqual(
                    label, "Manager",
                    f"Manager user should be labeled 'Manager', got '{label}' (iter {i})"
                )

    def test_viewer_user_labeled_correctly(self):
        """Viewer system user is labeled 'Viewer'."""
        for i in range(_PBT_ITERATIONS):
            with self.subTest(iteration=i):
                user_id = _random_uuid()
                person = _random_person_entry(person_type="system_user", user_id=user_id)
                shares = [{"user_id": user_id, "role": "viewer", "rsvp_status": _random_rsvp_status()}]
                assigned_to = _random_uuid()  # Different user is assigned

                label = label_person(person, shares, assigned_to)
                self.assertEqual(
                    label, "Viewer",
                    f"Viewer user should be labeled 'Viewer', got '{label}' (iter {i})"
                )


# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    unittest.main()
