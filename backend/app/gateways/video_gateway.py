import asyncio
import base64
import logging
import os
import random
import uuid

from app.config import settings

logger = logging.getLogger(__name__)
from app.gateways.base import GenerateRequest, GenerateResponse, ModelProvider

PLACEHOLDER_VIDEOS = [
    "https://placehold.co/1920x1080/1a1a2e/e0e0e0?text=Scene+{idx}+Video",
    "https://placehold.co/1920x1080/16213e/e0e0e0?text=Scene+{idx}+Video",
    "https://placehold.co/1920x1080/0f3460/e0e0e0?text=Scene+{idx}+Video",
    "https://placehold.co/1920x1080/533483/e0e0e0?text=Scene+{idx}+Video",
]

VEO_MODEL = "veo-3.0-generate-001"
VEO_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{VEO_MODEL}:predictLongRunning"
OPERATIONS_URL = "https://generativelanguage.googleapis.com/v1beta"


class VideoGateway(ModelProvider):
    def __init__(self):
        self.mode = settings.AI_MODE

    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        if self.mode == "mock":
            return await self._mock_generate(request)
        return await self._live_generate(request)

    async def _mock_generate(self, request: GenerateRequest) -> GenerateResponse:
        await asyncio.sleep(random.uniform(1.0, 3.0))
        idx = request.params.get("scene_index", 0) if request.params else 0
        video_url = random.choice(PLACEHOLDER_VIDEOS).format(idx=idx + 1)
        return GenerateResponse(content=video_url, model_id="veo-3.1", usage={"mock": True})

    async def _live_generate(self, request: GenerateRequest) -> GenerateResponse:
        import httpx

        # Veo 3.0 only supports durationSeconds = 4 or 8
        raw_dur = int(request.params.get("duration_sec", 8)) if request.params else 8
        duration = 8 if raw_dur > 5 else 4

        # Build request body
        instance: dict = {"prompt": request.prompt}

        # If we have a key image, include it for image-to-video
        image_path = request.params.get("image_url", "") if request.params else ""
        if image_path and image_path.startswith("/uploads/"):
            local_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(image_path))
            if os.path.exists(local_path):
                with open(local_path, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode()
                instance["image"] = {
                    "bytesBase64Encoded": img_b64,
                    "mimeType": "image/png",
                }

        body = {
            "instances": [instance],
            "parameters": {
                "aspectRatio": "16:9",
                "durationSeconds": duration,
            },
        }

        async with httpx.AsyncClient() as client:
            # Start generation
            resp = await client.post(
                VEO_API_URL,
                headers={
                    "x-goog-api-key": settings.GOOGLE_API_KEY,
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=60.0,
            )
            resp.raise_for_status()
            op_data = resp.json()
            op_name = op_data["name"]

            # Poll for completion
            for _ in range(120):  # Up to 20 min
                await asyncio.sleep(10)
                status_resp = await client.get(
                    f"{OPERATIONS_URL}/{op_name}",
                    headers={"x-goog-api-key": settings.GOOGLE_API_KEY},
                    timeout=30.0,
                )
                status_data = status_resp.json()

                if status_data.get("done"):
                    # Check for error
                    if "error" in status_data:
                        raise RuntimeError(f"Veo error: {status_data['error']}")

                    # Extract video
                    response = status_data.get("response", {})
                    generated = response.get("generateVideoResponse", {}).get("generatedSamples", [])

                    if not generated:
                        # Check for RAI/safety filter
                        gen_resp = response.get("generateVideoResponse", {})
                        rai_reasons = gen_resp.get("raiMediaFilteredReasons", [])
                        if rai_reasons:
                            raise RuntimeError(f"안전 필터 차단: {rai_reasons[0]}")
                        logger.error(f"Veo response: {str(status_data)[:500]}")
                        raise RuntimeError("영상 생성 실패 — 응답 없음")

                    video_uri = generated[0].get("video", {}).get("uri", "")

                    if not video_uri:
                        raise RuntimeError("No video URI in response")

                    # Download video to local (follow redirects)
                    video_resp = await client.get(
                        video_uri,
                        headers={"x-goog-api-key": settings.GOOGLE_API_KEY},
                        timeout=120.0,
                        follow_redirects=True,
                    )
                    video_resp.raise_for_status()

                    filename = f"{uuid.uuid4()}.mp4"
                    filepath = os.path.join(settings.UPLOAD_DIR, filename)
                    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

                    with open(filepath, "wb") as f:
                        f.write(video_resp.content)

                    return GenerateResponse(
                        content=f"/uploads/{filename}",
                        model_id="veo-3.1",
                        usage={"model": VEO_MODEL, "duration": duration},
                    )

            raise TimeoutError("Video generation timed out (20 min)")

    def get_capabilities(self) -> dict:
        return {
            "id": "veo-3.1",
            "provider": "google",
            "capabilities": ["image_to_video", "text_to_video"],
            "max_duration_sec": 8,
            "model": VEO_MODEL,
        }


video_gateway = VideoGateway()
