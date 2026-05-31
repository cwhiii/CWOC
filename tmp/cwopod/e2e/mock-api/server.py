"""
Mock API server for E2E testing.

Simulates external services:
- Ollama (local LLM)
- ComfyUI (local image generation)
- Lulu xPress (print provider)
- BookVault (print provider)
- Project Gutenberg (source search/download)
- Standard Ebooks (source search/download)

Configurable behavior:
- FAIL_FIRST_AI_CALL=true: First AI call fails, subsequent calls succeed (for retry testing)
"""

import base64
import os
import time
from io import BytesIO

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response

app = FastAPI(title="CWOPOD Mock API")

# Track call counts for retry testing
call_counts: dict[str, int] = {}
FAIL_FIRST = os.environ.get("FAIL_FIRST_AI_CALL", "false").lower() == "true"


def should_fail(endpoint: str) -> bool:
    """Return True if this endpoint should fail (for retry testing)."""
    if not FAIL_FIRST:
        return False
    call_counts.setdefault(endpoint, 0)
    call_counts[endpoint] += 1
    return call_counts[endpoint] == 1  # Fail only the first call


# --- Ollama Mock (Text Generation) ---


@app.post("/api/generate")
async def ollama_generate(request: Request):
    """Mock Ollama text generation endpoint."""
    if should_fail("ollama_generate"):
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")

    body = await request.json()
    prompt = body.get("prompt", "")

    # Generate contextual mock responses based on prompt content
    if "typo" in prompt.lower() or "correction" in prompt.lower():
        response_text = '[]'  # No typos found
    elif "prompt" in prompt.lower() and "cover" in prompt.lower():
        response_text = """[
            {"prompt": "A gothic castle on a stormy night with lightning illuminating ancient stone walls", "description": "Dark atmosphere"},
            {"prompt": "A lone figure walking through a misty forest at dawn", "description": "Mystery and solitude"},
            {"prompt": "An old leather-bound book open on a wooden desk with candlelight", "description": "Classic literature feel"},
            {"prompt": "A ship sailing through turbulent seas under a dramatic sky", "description": "Adventure and danger"},
            {"prompt": "A Victorian-era laboratory with bubbling beakers and electrical equipment", "description": "Science and discovery"},
            {"prompt": "Snow-covered mountains reflected in a still alpine lake", "description": "Natural beauty"},
            {"prompt": "A grand library with towering bookshelves and warm lamplight", "description": "Knowledge and wisdom"},
            {"prompt": "A winding cobblestone street in an old European town at twilight", "description": "Historical setting"},
            {"prompt": "A garden in full bloom with butterflies and morning dew", "description": "Life and renewal"},
            {"prompt": "A silhouette against a sunset over rolling hills", "description": "Journey and reflection"}
        ]"""
    elif "blurb" in prompt.lower() or "synopsis" in prompt.lower():
        response_text = (
            "In this timeless tale, a brilliant scientist pushes the boundaries of human knowledge, "
            "only to discover that some doors, once opened, can never be closed. A story of ambition, "
            "consequence, and the eternal question of what it means to be human. This masterwork of "
            "gothic literature continues to captivate readers with its profound exploration of creation, "
            "responsibility, and the darkness that lurks within us all."
        )
    else:
        response_text = "Mock AI response for testing purposes."

    return {
        "model": "mock-model",
        "created_at": "2024-01-01T00:00:00Z",
        "response": response_text,
        "done": True,
    }


@app.post("/api/chat")
async def ollama_chat(request: Request):
    """Mock Ollama chat endpoint."""
    if should_fail("ollama_chat"):
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")

    body = await request.json()
    messages = body.get("messages", [])
    last_message = messages[-1]["content"] if messages else ""

    return {
        "model": "mock-model",
        "message": {
            "role": "assistant",
            "content": f"Mock response to: {last_message[:50]}",
        },
        "done": True,
    }


@app.get("/api/tags")
async def ollama_list_models():
    """Mock Ollama list models endpoint."""
    return {
        "models": [
            {
                "name": "llama3.2:1b",
                "size": 1300000000,
                "modified_at": "2024-01-01T00:00:00Z",
                "digest": "abc123def456",
            }
        ]
    }


@app.get("/api/ps")
async def ollama_running_models():
    """Mock Ollama running models endpoint."""
    return {
        "models": [
            {
                "name": "llama3.2:1b",
                "size": 1300000000,
                "expires_at": "2024-01-01T01:00:00Z",
            }
        ]
    }


@app.post("/api/pull")
async def ollama_pull(request: Request):
    """Mock Ollama model pull endpoint."""
    body = await request.json()
    model_name = body.get("model", "")
    if not model_name:
        raise HTTPException(status_code=400, detail="Model name required")
    # Simulate a successful pull
    return {"status": "success"}


# --- ComfyUI Mock (Image Generation) ---


@app.post("/prompt")
async def comfyui_prompt(request: Request):
    """Mock ComfyUI prompt submission."""
    if should_fail("comfyui_prompt"):
        raise HTTPException(status_code=503, detail="Image generation service unavailable")

    return {"prompt_id": "mock-prompt-id-12345"}


@app.get("/history/{prompt_id}")
async def comfyui_history(prompt_id: str):
    """Mock ComfyUI history/status endpoint."""
    return {
        prompt_id: {
            "status": {"completed": True},
            "outputs": {
                "images": [{"filename": "mock_cover.png", "subfolder": "", "type": "output"}]
            },
        }
    }


@app.get("/view")
async def comfyui_view():
    """Mock ComfyUI image download - returns a minimal valid PNG."""
    # 1x1 pixel red PNG for testing
    png_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAw"
        "AB/gL+hEMrNAAAAABJRU5ErkJggg=="
    )
    # Scale up to meet minimum resolution requirements (return as-is for mock)
    return Response(content=png_data, media_type="image/png")


# --- Lulu xPress Mock (Print Provider) ---


@app.post("/lulu/v1/print-jobs")
async def lulu_create_print_job(request: Request):
    """Mock Lulu print job creation."""
    body = await request.json()
    return {
        "id": f"lulu-order-{int(time.time())}",
        "status": {"name": "CREATED"},
        "line_items": body.get("line_items", []),
    }


@app.get("/lulu/v1/print-jobs/{job_id}")
async def lulu_get_print_job(job_id: str):
    """Mock Lulu print job status."""
    return {
        "id": job_id,
        "status": {"name": "IN_PRODUCTION"},
    }


@app.post("/lulu/v1/print-job-cost-calculations")
async def lulu_pricing():
    """Mock Lulu pricing estimate."""
    return {
        "total_cost_excl_tax": "12.50",
        "total_tax": "1.25",
        "total_cost_incl_tax": "13.75",
        "currency": "USD",
    }


@app.post("/lulu/v1/isbns")
async def lulu_isbn():
    """Mock Lulu free ISBN assignment."""
    return {
        "isbn": "978-0-123456-78-9",
        "status": "ASSIGNED",
    }


# --- BookVault Mock ---


@app.post("/bookvault/api/v1/orders")
async def bookvault_create_order(request: Request):
    """Mock BookVault order creation."""
    return {
        "order_id": f"bv-{int(time.time())}",
        "status": "accepted",
    }


@app.get("/bookvault/api/v1/quotes")
async def bookvault_pricing():
    """Mock BookVault pricing."""
    return {
        "unit_price": "8.99",
        "shipping": "3.50",
        "total": "12.49",
        "currency": "GBP",
    }


# --- Project Gutenberg Mock ---


@app.get("/gutenberg/ebooks")
async def gutenberg_search(q: str = ""):
    """Mock Gutenberg search results."""
    results = [
        {
            "id": "84",
            "title": "Frankenstein; Or, The Modern Prometheus",
            "author": "Mary Wollstonecraft Shelley",
            "source": "gutenberg",
            "quality_label": "community curated",
        },
        {
            "id": "1342",
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "source": "gutenberg",
            "quality_label": "community curated",
        },
        {
            "id": "11",
            "title": "Alice's Adventures in Wonderland",
            "author": "Lewis Carroll",
            "source": "gutenberg",
            "quality_label": "community curated",
        },
    ]
    # Filter by query
    if q:
        q_lower = q.lower()
        results = [r for r in results if q_lower in r["title"].lower() or q_lower in r["author"].lower()]

    return {"results": results}


@app.get("/gutenberg/ebooks/{book_id}")
async def gutenberg_download(book_id: str):
    """Mock Gutenberg book download."""
    books = {
        "84": {
            "title": "Frankenstein; Or, The Modern Prometheus",
            "author": "Mary Wollstonecraft Shelley",
            "text": "Chapter 1\n\nI am by birth a Genevese, and my family is one of the most distinguished...",
            "metadata": {
                "source_url": f"https://www.gutenberg.org/ebooks/{book_id}",
                "publication_year": "1818",
                "language": "en",
            },
        },
        "1342": {
            "title": "Pride and Prejudice",
            "author": "Jane Austen",
            "text": "Chapter 1\n\nIt is a truth universally acknowledged, that a single man in possession...",
            "metadata": {
                "source_url": f"https://www.gutenberg.org/ebooks/{book_id}",
                "publication_year": "1813",
                "language": "en",
            },
        },
    }
    book = books.get(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


# --- Standard Ebooks Mock ---


@app.get("/standardebooks/opds")
async def standard_ebooks_search(q: str = ""):
    """Mock Standard Ebooks OPDS feed search."""
    results = [
        {
            "id": "se-frankenstein",
            "title": "Frankenstein",
            "author": "Mary Shelley",
            "source": "standard_ebooks",
            "quality_label": "professionally curated",
        },
    ]
    if q:
        q_lower = q.lower()
        results = [r for r in results if q_lower in r["title"].lower() or q_lower in r["author"].lower()]

    return {"results": results}


# --- Health Check ---


@app.get("/health")
async def health():
    """Health check for the mock server."""
    return {"status": "ok", "service": "mock-api"}


# --- Reset endpoint for test isolation ---


@app.post("/reset")
async def reset():
    """Reset all call counters (for test isolation)."""
    global call_counts
    call_counts = {}
    return {"status": "reset"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "9000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
