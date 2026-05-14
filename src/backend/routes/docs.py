"""Documentation routes — serves help markdown files and provides cross-file search.

Automatically discovers all .md files in the documentation/ directory, so new
files are included in search results without any code changes.
"""

import os
import re
import logging

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()

# Help documentation directory — lives in src/help/ (deployed with src/)
_DOCS_DIRS = [
    "/app/src/help",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "help"),
    os.path.join(os.getcwd(), "src", "help"),
]


def _get_docs_dir():
    """Find the documentation directory."""
    for d in _DOCS_DIRS:
        if os.path.isdir(d):
            return d
    logger.warning(f"Documentation directory not found. Checked: {_DOCS_DIRS}")
    return None


def _list_doc_files(include_index=False):
    """Return list of .md files in the documentation directory.

    Automatically picks up any new .md files added to the directory.
    """
    docs_dir = _get_docs_dir()
    if not docs_dir:
        return []
    files = []
    for f in sorted(os.listdir(docs_dir)):
        if f.endswith(".md"):
            if f == "index.md" and not include_index:
                continue
            files.append(f)
    return files


@router.get("/api/docs")
def get_docs_index():
    """Return the index.md content and list of available doc files."""
    docs_dir = _get_docs_dir()
    if not docs_dir:
        # Return empty result instead of 404 so the page still renders
        return {"index": "", "files": [], "error": "Documentation directory not found"}

    index_path = os.path.join(docs_dir, "index.md")
    index_content = ""
    if os.path.isfile(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            index_content = f.read()

    files = _list_doc_files()
    return {"index": index_content, "files": files}


@router.get("/api/docs-search")
def search_docs(q: str = Query(..., min_length=1, max_length=200)):
    """Search across ALL documentation files. Returns matching snippets with context.

    Automatically includes any new .md files added to the documentation/ directory.
    Multi-word queries use AND logic (all terms must appear in the file).
    """
    docs_dir = _get_docs_dir()
    if not docs_dir:
        return {"query": q, "results": [], "error": "Documentation directory not found"}

    query_lower = q.lower()
    terms = query_lower.split()
    results = []

    for filename in _list_doc_files(include_index=False):
        filepath = os.path.join(docs_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except (IOError, OSError):
            continue

        content_lower = content.lower()

        # Check if ALL terms appear in the file
        if not all(term in content_lower for term in terms):
            continue

        # Find matching lines with context
        lines = content.split("\n")
        matches = []
        title = filename.replace(".md", "").replace("-", " ").title()

        # Extract title from first H1
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break

        for i, line in enumerate(lines):
            line_lower = line.lower()
            if any(term in line_lower for term in terms):
                # Get context: 1 line before and after
                start = max(0, i - 1)
                end = min(len(lines), i + 2)
                snippet = "\n".join(lines[start:end]).strip()
                if snippet and len(matches) < 3:  # Max 3 snippets per file
                    matches.append(snippet)

        if matches:
            results.append({
                "filename": filename,
                "title": title,
                "matches": matches,
            })

    # Sort by number of matches (most relevant first)
    results.sort(key=lambda r: len(r["matches"]), reverse=True)
    return {"query": q, "results": results[:20]}


@router.get("/api/docs/{slug}")
def get_doc_file(slug: str):
    """Return the content of a specific documentation file.
    
    Accepts the slug without .md extension (e.g., 'ntfy-notifications')
    or with it (e.g., 'ntfy-notifications.md').
    """
    try:
        # Normalize: add .md if not present
        filename = slug if slug.endswith(".md") else slug + ".md"
        
        # Sanitize — only allow alphanumeric, hyphens, and .md extension
        if not re.match(r'^[a-z0-9\-]+\.md$', filename):
            raise HTTPException(status_code=400, detail="Invalid filename")

        docs_dir = _get_docs_dir()
        if not docs_dir:
            raise HTTPException(status_code=404, detail="Documentation directory not found")

        filepath = os.path.join(docs_dir, filename)
        if not os.path.isfile(filepath):
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        return {"filename": filename, "content": content}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving doc {slug}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading documentation: {str(e)}")
