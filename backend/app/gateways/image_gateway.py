import asyncio
import base64
import os
import random
import uuid

from app.config import settings
from app.gateways.base import GenerateRequest, GenerateResponse, ModelProvider

PLACEHOLDER_IMAGES = [
    "https://placehold.co/1024x576/1a1a2e/e0e0e0?text=Scene+{idx}+Key+Image",
    "https://placehold.co/1024x576/16213e/e0e0e0?text=Scene+{idx}+Key+Image",
    "https://placehold.co/1024x576/0f3460/e0e0e0?text=Scene+{idx}+Key+Image",
    "https://placehold.co/1024x576/533483/e0e0e0?text=Scene+{idx}+Key+Image",
]

GEMINI_MODEL = "gemini-2.5-flash-image"
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


class ImageGateway(ModelProvider):
    def __init__(self):
        self.mode = settings.AI_MODE

    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        if self.mode == "mock":
            return await self._mock_generate(request)
        return await self._live_generate(request)

    async def _mock_generate(self, request: GenerateRequest) -> GenerateResponse:
        await asyncio.sleep(random.uniform(0.5, 1.5))
        idx = request.params.get("scene_index", 0) if request.params else 0
        image_url = random.choice(PLACEHOLDER_IMAGES).format(idx=idx + 1)
        return GenerateResponse(content=image_url, model_id="nano-banana-2", usage={"mock": True})

    async def _live_generate(self, request: GenerateRequest) -> GenerateResponse:
        import httpx

        # Build parts: text prompt + optional reference images
        parts: list[dict] = []

        # Add reference images if provided
        ref_urls = request.params.get("reference_urls", []) if request.params else []
        for ref_url in ref_urls:
            if ref_url and ref_url.startswith("/uploads/"):
                local_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(ref_url))
                if os.path.exists(local_path):
                    with open(local_path, "rb") as f:
                        img_b64 = base64.b64encode(f.read()).decode()
                    ext = os.path.splitext(local_path)[1].lower()
                    mime = "image/png" if ext == ".png" else "image/jpeg" if ext in (".jpg", ".jpeg") else "image/webp"
                    parts.append({"inlineData": {"mimeType": mime, "data": img_b64}})

        ref_note = f" Use the provided reference image(s) as style/composition guide." if ref_urls else ""
        parts.append({"text": f"Generate a high-quality cinematic image: {request.prompt}{ref_note}"})

        body = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": "16:9",
                },
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                GEMINI_API_URL,
                headers={
                    "x-goog-api-key": settings.GOOGLE_API_KEY,
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=120.0,
            )
            resp.raise_for_status()
            data = resp.json()

        # Extract image from response
        candidates = data.get("candidates", [])
        if not candidates:
            raise RuntimeError("No image generated")

        parts = candidates[0].get("content", {}).get("parts", [])
        image_data = None
        mime_type = "image/png"

        for part in parts:
            if "inlineData" in part:
                image_data = part["inlineData"]["data"]
                mime_type = part["inlineData"].get("mimeType", "image/png")
                break

        if not image_data:
            raise RuntimeError("No image data in response")

        # Save to local file
        ext = "png" if "png" in mime_type else "jpg" if "jpeg" in mime_type or "jpg" in mime_type else "webp"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        with open(filepath, "wb") as f:
            f.write(base64.b64decode(image_data))

        image_url = f"/uploads/{filename}"

        return GenerateResponse(
            content=image_url,
            model_id="nano-banana-2",
            usage={"model": GEMINI_MODEL},
        )

    def get_capabilities(self) -> dict:
        return {
            "id": "nano-banana-2",
            "provider": "google",
            "capabilities": ["text_to_image"],
            "model": GEMINI_MODEL,
        }


image_gateway = ImageGateway()
