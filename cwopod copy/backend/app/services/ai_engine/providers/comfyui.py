"""ComfyUI provider: local image generation via ComfyUI HTTP API."""

import asyncio
import logging
import time
from typing import Callable

import httpx

from app.services.ai_engine.base import AIProvider, AIProviderError

logger = logging.getLogger(__name__)

# Maximum time (seconds) to wait with NO progress before giving up.
# As long as ComfyUI reports the job is queued or running, we keep waiting.
_STALL_TIMEOUT = 120  # 2 minutes of zero progress = dead
_POLL_INTERVAL = 1.0  # seconds between polls


class ComfyUIProvider(AIProvider):
    """Local image generation using ComfyUI."""

    def __init__(self, base_url: str = "http://comfyui:8188", model: str = "sd_xl_base_1.0"):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def generate_text(
        self, prompt: str, system_prompt: str = "", max_tokens: int = 2048
    ) -> str:
        raise NotImplementedError("ComfyUIProvider does not support text generation")

    async def generate_image(
        self, prompt: str, width: int = 1600, height: int = 2400
    ) -> bytes:
        """Generate an image via ComfyUI's workflow API.

        1. POST workflow to /prompt
        2. Poll /history/{prompt_id} until complete
        3. GET /view?filename={output} to retrieve image

        Note: For SD 1.5 models, dimensions are automatically capped to 512x768
        to avoid OOM on GPUs with limited VRAM. The caller can request any size
        and the provider will scale down if needed for the model.
        """
        # SD 1.5 models work best at 512x768 max. SDXL can handle 1024x1536.
        # Detect model type from filename and cap dimensions accordingly.
        is_sd15 = "v1-5" in self.model.lower() or "sd-v1" in self.model.lower()
        is_sdxl = "xl" in self.model.lower() or "sdxl" in self.model.lower()

        if is_sd15:
            # SD 1.5: max 512x768, maintain aspect ratio
            max_w, max_h = 512, 768
        elif is_sdxl:
            # SDXL: max 1024x1536
            max_w, max_h = 1024, 1536
        else:
            # Unknown model — assume SD 1.5 constraints for safety
            max_w, max_h = 512, 768

        # Scale down while preserving aspect ratio
        if width > max_w or height > max_h:
            scale = min(max_w / width, max_h / height)
            width = int(width * scale)
            height = int(height * scale)
            # Round to nearest 8 (required by stable diffusion)
            width = (width // 8) * 8
            height = (height // 8) * 8

        logger.info("generate_image: model=%s, dimensions=%dx%d, is_sd15=%s, is_sdxl=%s", self.model, width, height, is_sd15, is_sdxl)
        logger.debug("generate_image: prompt=%s", prompt[:200])

        workflow = self._build_workflow(prompt, width, height)

        try:
            # Per-request timeout for individual HTTP calls (submit, poll, download).
            # The progress-aware _poll_completion loop is the real timeout mechanism —
            # it keeps going as long as ComfyUI shows the job is alive.
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=30.0)) as client:
                # Submit workflow
                logger.debug("generate_image: submitting workflow to %s/prompt", self.base_url)
                response = await client.post(
                    f"{self.base_url}/prompt", json={"prompt": workflow}
                )
                response.raise_for_status()
                prompt_id = response.json()["prompt_id"]
                logger.info("generate_image: workflow submitted, prompt_id=%s", prompt_id)

                # Poll for completion — keeps going as long as progress is detected
                image_filename = await self._poll_completion(client, prompt_id)
                logger.info("generate_image: generation complete, filename=%s", image_filename)

                # Download image
                img_response = await client.get(
                    f"{self.base_url}/view",
                    params={"filename": image_filename},
                )
                img_response.raise_for_status()
                logger.info("generate_image: downloaded image, size=%d bytes", len(img_response.content))
                return img_response.content

        except httpx.TimeoutException:
            logger.error("generate_image: HTTP request timed out, base_url=%s", self.base_url)
            raise AIProviderError(
                "ComfyUI HTTP request timed out",
                provider="comfyui",
                is_timeout=True,
            )
        except httpx.ConnectError as e:
            logger.error("generate_image: connection refused, base_url=%s, error=%s", self.base_url, str(e))
            raise AIProviderError(
                f"Local AI service (ComfyUI) is not available at {self.base_url}. "
                f"The ComfyUI container may not be running. "
                f"Check: docker compose ps comfyui | Connection error: {str(e)}",
                provider="comfyui",
            )
        except httpx.HTTPStatusError as e:
            logger.error("generate_image: HTTP error %d from ComfyUI", e.response.status_code)
            raise AIProviderError(
                f"ComfyUI returned error: {e.response.status_code}",
                provider="comfyui",
            )

    async def generate_image_with_progress(
        self, prompt: str, width: int = 1600, height: int = 2400,
        on_progress: Callable[[int, int, bytes | None], None] | None = None,
    ) -> bytes:
        """Generate an image with real step-by-step progress via ComfyUI WebSocket.

        Like generate_image but connects to ComfyUI's WebSocket to receive
        real-time progress updates (step X of N) and preview images at each step.

        Args:
            prompt: Text prompt for image generation.
            width: Desired image width.
            height: Desired image height.
            on_progress: Callback(current_step, total_steps, preview_bytes_or_None)
                         Called at each sampling step with optional preview image.
        """
        # Apply same dimension capping as generate_image
        is_sd15 = "v1-5" in self.model.lower() or "sd-v1" in self.model.lower()
        is_sdxl = "xl" in self.model.lower() or "sdxl" in self.model.lower()

        if is_sd15:
            max_w, max_h = 512, 768
        elif is_sdxl:
            max_w, max_h = 1024, 1536
        else:
            max_w, max_h = 512, 768

        if width > max_w or height > max_h:
            scale = min(max_w / width, max_h / height)
            width = int(width * scale)
            height = int(height * scale)
            width = (width // 8) * 8
            height = (height // 8) * 8

        logger.info(
            "generate_image_with_progress: model=%s, dimensions=%dx%d, is_sd15=%s, is_sdxl=%s",
            self.model, width, height, is_sd15, is_sdxl,
        )
        logger.debug("generate_image_with_progress: prompt=%s", prompt[:200])

        workflow = self._build_workflow(prompt, width, height)

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(timeout=30.0)) as client:
                # Generate a unique client_id for this generation session.
                # ComfyUI routes WebSocket messages (including preview images)
                # to the client_id that submitted the prompt.
                import uuid
                client_id = f"cwopod-{uuid.uuid4().hex[:12]}"

                # Connect WebSocket FIRST, then submit prompt with matching client_id.
                # This ensures we don't miss any early progress messages.
                image_filename = await self._ws_poll_completion(
                    client, workflow, client_id, on_progress
                )
                logger.info("generate_image_with_progress: generation complete, filename=%s", image_filename)

                # Download final image
                img_response = await client.get(
                    f"{self.base_url}/view",
                    params={"filename": image_filename},
                )
                img_response.raise_for_status()
                logger.info(
                    "generate_image_with_progress: downloaded image, size=%d bytes",
                    len(img_response.content),
                )
                return img_response.content

        except httpx.TimeoutException:
            logger.error("generate_image_with_progress: HTTP request timed out, base_url=%s", self.base_url)
            raise AIProviderError(
                "ComfyUI HTTP request timed out",
                provider="comfyui",
                is_timeout=True,
            )
        except httpx.ConnectError as e:
            logger.error("generate_image_with_progress: connection refused, base_url=%s, error=%s", self.base_url, str(e))
            raise AIProviderError(
                f"Local AI service (ComfyUI) is not available at {self.base_url}. "
                f"The ComfyUI container may not be running. "
                f"Check: docker compose ps comfyui | Connection error: {str(e)}",
                provider="comfyui",
            )
        except httpx.HTTPStatusError as e:
            logger.error("generate_image_with_progress: HTTP error %d from ComfyUI", e.response.status_code)
            raise AIProviderError(
                f"ComfyUI returned error: {e.response.status_code}",
                provider="comfyui",
            )

    async def _ws_poll_completion(
        self, client: httpx.AsyncClient, workflow: dict, client_id: str,
        on_progress: Callable[[int, int, bytes | None], None] | None = None,
    ) -> str:
        """Connect WebSocket, submit prompt, and receive real-time step progress + preview images.

        ComfyUI sends preview images as binary WebSocket messages to the client_id
        that submitted the prompt. We connect first, then submit, so we catch everything.

        Falls back to HTTP polling if WebSocket connection fails.
        """
        import json

        # Convert http(s) URL to ws(s) URL
        ws_url = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url}/ws?clientId={client_id}"

        logger.info("_ws_poll_completion: connecting to WebSocket at %s", ws_url)

        try:
            import websockets
            async with websockets.connect(ws_url, close_timeout=5, max_size=50 * 1024 * 1024) as ws:
                logger.info("_ws_poll_completion: WebSocket connected with client_id=%s", client_id)

                # Now submit the prompt with our client_id so ComfyUI routes messages to us.
                # Include extra_data to enable preview images at each sampling step.
                logger.debug("_ws_poll_completion: submitting workflow to %s/prompt", self.base_url)
                response = await client.post(
                    f"{self.base_url}/prompt",
                    json={
                        "prompt": workflow,
                        "client_id": client_id,
                        "extra_data": {
                            "extra_pnginfo": {},
                            "client_id": client_id,
                        },
                    },
                )
                response.raise_for_status()
                prompt_id = response.json()["prompt_id"]
                logger.info("_ws_poll_completion: workflow submitted, prompt_id=%s, client_id=%s", prompt_id, client_id)

                last_progress_time = time.monotonic()

                while True:
                    try:
                        message = await asyncio.wait_for(ws.recv(), timeout=_STALL_TIMEOUT)
                    except asyncio.TimeoutError:
                        logger.error("_ws_poll_completion: no WebSocket message for %ds, stall timeout", _STALL_TIMEOUT)
                        raise AIProviderError(
                            f"ComfyUI generation stalled — no progress for {_STALL_TIMEOUT} seconds",
                            provider="comfyui",
                            is_timeout=True,
                        )

                    # WebSocket messages can be text (JSON) or binary (preview image)
                    if isinstance(message, bytes):
                        # Binary message: preview image data
                        # ComfyUI binary format: first 4 bytes = event type (int),
                        # next 4 bytes = format (int), rest = image data (JPEG/PNG)
                        if len(message) > 8:
                            preview_bytes = message[8:]  # Skip 8-byte binary header
                            last_progress_time = time.monotonic()
                            logger.debug(
                                "_ws_poll_completion: received preview image, size=%d bytes",
                                len(preview_bytes),
                            )
                            if on_progress:
                                on_progress(-1, -1, preview_bytes)
                        continue

                    # Text message: JSON status update
                    try:
                        data = json.loads(message)
                    except json.JSONDecodeError:
                        logger.debug("_ws_poll_completion: non-JSON message, skipping")
                        continue

                    msg_type = data.get("type")

                    if msg_type == "progress":
                        # Real step progress: {"type": "progress", "data": {"value": 5, "max": 30, ...}}
                        progress_data = data.get("data", {})
                        current_step = progress_data.get("value", 0)
                        total_steps = progress_data.get("max", 30)
                        last_progress_time = time.monotonic()
                        logger.debug(
                            "_ws_poll_completion: step %d/%d",
                            current_step, total_steps,
                        )
                        if on_progress:
                            on_progress(current_step, total_steps, None)

                    elif msg_type == "executing":
                        exec_data = data.get("data", {})
                        node = exec_data.get("node")
                        exec_prompt_id = exec_data.get("prompt_id")
                        last_progress_time = time.monotonic()

                        if exec_prompt_id == prompt_id and node is None:
                            # Execution complete for our prompt
                            logger.info("_ws_poll_completion: execution complete for prompt_id=%s", prompt_id)
                            break

                        if node:
                            logger.debug("_ws_poll_completion: executing node=%s", node)

                    elif msg_type == "execution_cached":
                        last_progress_time = time.monotonic()
                        logger.debug("_ws_poll_completion: execution cached")

                    elif msg_type == "execution_error":
                        error_data = data.get("data", {})
                        error_msg = error_data.get("exception_message", "unknown error")
                        logger.error("_ws_poll_completion: execution error: %s", error_msg)
                        raise AIProviderError(
                            f"ComfyUI generation failed: {error_msg}",
                            provider="comfyui",
                        )

                # WebSocket loop done — fetch the output filename from history
                logger.info("_ws_poll_completion: fetching output from history")
                return await self._get_output_filename(client, prompt_id)

        except ImportError:
            logger.warning("_ws_poll_completion: websockets library not available, falling back to HTTP polling")
            return await self._submit_and_poll(client, workflow)
        except AIProviderError:
            raise  # Don't swallow our own errors (stall timeout, execution error)
        except (OSError, ConnectionRefusedError) as e:
            logger.warning("_ws_poll_completion: WebSocket connection failed (%s: %s), falling back to HTTP polling", type(e).__name__, e)
            return await self._submit_and_poll(client, workflow)
        except Exception as e:
            # Catch websockets library exceptions (InvalidURI, InvalidHandshake, etc.)
            logger.warning("_ws_poll_completion: WebSocket error (%s: %s), falling back to HTTP polling", type(e).__name__, e)
            return await self._submit_and_poll(client, workflow)

    async def _submit_and_poll(self, client: httpx.AsyncClient, workflow: dict) -> str:
        """Fallback: submit prompt via HTTP and poll history for completion (no previews)."""
        logger.info("_submit_and_poll: submitting workflow via HTTP (no WebSocket previews)")
        response = await client.post(
            f"{self.base_url}/prompt", json={"prompt": workflow}
        )
        response.raise_for_status()
        prompt_id = response.json()["prompt_id"]
        logger.info("_submit_and_poll: workflow submitted, prompt_id=%s", prompt_id)
        return await self._poll_completion(client, prompt_id)

    async def _get_output_filename(self, client: httpx.AsyncClient, prompt_id: str) -> str:
        """Fetch the output image filename from ComfyUI history after completion."""
        for attempt in range(10):
            try:
                response = await client.get(f"{self.base_url}/history/{prompt_id}")
                if response.status_code == 200:
                    data = response.json()
                    if prompt_id in data:
                        outputs = data[prompt_id].get("outputs", {})
                        for node_id, node_output in outputs.items():
                            if "images" in node_output:
                                return node_output["images"][0]["filename"]
            except httpx.TimeoutException:
                pass
            await asyncio.sleep(0.5)

        raise AIProviderError(
            "Could not retrieve output image from ComfyUI history",
            provider="comfyui",
        )

    async def _poll_completion(
        self, client: httpx.AsyncClient, prompt_id: str
    ) -> str:
        """Poll ComfyUI until the prompt completes.

        Strategy: keep polling as long as ComfyUI shows the job is queued or
        running.  Only timeout if we see no sign of life for _STALL_TIMEOUT
        seconds.  This handles slow model loads and long generation times
        gracefully — as long as ComfyUI is working, we wait.
        """
        last_progress_time = time.monotonic()
        last_status = None
        poll_count = 0

        while True:
            await asyncio.sleep(_POLL_INTERVAL)
            poll_count += 1
            elapsed_since_progress = time.monotonic() - last_progress_time

            # --- Check history first (job done?) ---
            try:
                response = await client.get(f"{self.base_url}/history/{prompt_id}")
            except httpx.TimeoutException:
                logger.warning("_poll_completion: history request timed out (poll %d), retrying", poll_count)
                continue

            if response.status_code == 200:
                data = response.json()
                if prompt_id in data:
                    # Job finished — look for output images
                    outputs = data[prompt_id].get("outputs", {})
                    for node_id, node_output in outputs.items():
                        if "images" in node_output:
                            logger.info(
                                "_poll_completion: done after %d polls (%.1fs)",
                                poll_count, time.monotonic() - (last_progress_time - elapsed_since_progress + elapsed_since_progress),
                            )
                            return node_output["images"][0]["filename"]

                    # Job is in history but has no image output — check for errors
                    status_info = data[prompt_id].get("status", {})
                    if status_info.get("status_str") == "error":
                        messages = status_info.get("messages", [])
                        error_msg = "; ".join(str(m) for m in messages) if messages else "unknown error"
                        logger.error("_poll_completion: ComfyUI reported error: %s", error_msg)
                        raise AIProviderError(
                            f"ComfyUI generation failed: {error_msg}",
                            provider="comfyui",
                        )

            # --- Check queue to see if job is still alive ---
            try:
                queue_resp = await client.get(f"{self.base_url}/queue")
            except httpx.TimeoutException:
                logger.warning("_poll_completion: queue request timed out (poll %d), retrying", poll_count)
                continue

            job_alive = False
            current_status = "unknown"

            if queue_resp.status_code == 200:
                queue_data = queue_resp.json()

                # Check running queue
                running = queue_data.get("queue_running", [])
                for item in running:
                    if len(item) >= 2 and item[1] == prompt_id:
                        job_alive = True
                        current_status = "running"
                        break

                # Check pending queue
                if not job_alive:
                    pending = queue_data.get("queue_pending", [])
                    for item in pending:
                        if len(item) >= 2 and item[1] == prompt_id:
                            job_alive = True
                            current_status = "pending"
                            break

            # If the job is alive in the queue, that counts as progress
            if job_alive:
                last_progress_time = time.monotonic()
                if current_status != last_status:
                    logger.info(
                        "_poll_completion: job %s status=%s (poll %d)",
                        prompt_id[:8], current_status, poll_count,
                    )
                    last_status = current_status
                elif poll_count % 30 == 0:
                    # Periodic heartbeat log every ~30 seconds
                    logger.info(
                        "_poll_completion: still %s, poll %d, waiting...",
                        current_status, poll_count,
                    )
                continue

            # Job not in queue AND not in history — might be transitioning
            # Give it a grace period before declaring it stalled
            if elapsed_since_progress < _STALL_TIMEOUT:
                if poll_count % 10 == 0:
                    logger.debug(
                        "_poll_completion: job not found in queue or history, "
                        "stall timer=%.0fs/%ds (poll %d)",
                        elapsed_since_progress, _STALL_TIMEOUT, poll_count,
                    )
                continue

            # Stall timeout exceeded — no progress detected
            logger.error(
                "_poll_completion: no progress for %ds, giving up after %d polls",
                _STALL_TIMEOUT, poll_count,
            )
            raise AIProviderError(
                f"ComfyUI generation stalled — no progress for {_STALL_TIMEOUT} seconds",
                provider="comfyui",
                is_timeout=True,
            )

    def _build_workflow(self, prompt: str, width: int, height: int) -> dict:
        """Build a basic txt2img workflow for ComfyUI."""
        return {
            "3": {
                "class_type": "KSampler",
                "inputs": {
                    "seed": 0,
                    "steps": 30,
                    "cfg": 7.0,
                    "sampler_name": "euler_ancestral",
                    "scheduler": "normal",
                    "denoise": 1.0,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0],
                },
            },
            "4": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {"ckpt_name": self.model},
            },
            "5": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": 1,
                },
            },
            "6": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": prompt, "clip": ["4", 1]},
            },
            "7": {
                "class_type": "CLIPTextEncode",
                "inputs": {
                    "text": (
                        "blurry, low quality, distorted, deformed, ugly, disfigured, "
                        "text, words, letters, numbers, title, watermark, signature, logo, "
                        "writing, font, caption, label, banner, stamp, "
                        "extra limbs, bad anatomy, bad hands, mutated, "
                        "oversaturated, underexposed, noise, grain, pixelated"
                    ),
                    "clip": ["4", 1],
                },
            },
            "8": {
                "class_type": "VAEDecode",
                "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
            },
            "9": {
                "class_type": "SaveImage",
                "inputs": {"images": ["8", 0], "filename_prefix": "cwopod"},
            },
        }

    async def upscale_image(self, image_bytes: bytes, target_width: int = 1600, target_height: int = 2400) -> bytes:
        """Upscale an image using ComfyUI's built-in Lanczos upscaler.

        This uses ComfyUI's ImageScale node which does high-quality Lanczos
        interpolation. For AI-based upscaling (Real-ESRGAN etc.), a model
        would need to be installed separately.

        Args:
            image_bytes: Source image as PNG bytes.
            target_width: Desired output width.
            target_height: Desired output height.

        Returns:
            Upscaled image as PNG bytes.
        """
        import io
        logger.info(
            "upscale_image: target=%dx%d, input_size=%d bytes",
            target_width, target_height, len(image_bytes),
        )

        # Use Pillow for Lanczos upscale — it's already a dependency,
        # faster than round-tripping through ComfyUI for a simple resize,
        # and produces excellent quality for this use case.
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        original_size = img.size
        logger.info("upscale_image: original dimensions=%dx%d", img.width, img.height)

        # Upscale using Lanczos (highest quality resampling)
        img_upscaled = img.resize((target_width, target_height), Image.LANCZOS)
        logger.info("upscale_image: upscaled to %dx%d", img_upscaled.width, img_upscaled.height)

        # Save as PNG
        output = io.BytesIO()
        img_upscaled.save(output, format="PNG", optimize=True)
        result_bytes = output.getvalue()
        logger.info(
            "upscale_image: done, %dx%d -> %dx%d, output_size=%d bytes",
            original_size[0], original_size[1], target_width, target_height, len(result_bytes),
        )
        return result_bytes
