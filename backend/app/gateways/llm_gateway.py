import json

from app.config import settings
from app.gateways.base import GenerateRequest, GenerateResponse, ModelProvider

SYSTEM_PROMPT = """당신은 AI 영상 제작 전문 기획자이자 하네스 엔지니어입니다.

## 핵심 목표
대화를 통해 **프로젝트 하네스(Harness)**를 완성하는 것이 최우선입니다.
하네스란 이 프로젝트 전체에 적용되는 '제작 지침서'로, 모든 씬의 이미지/영상 생성에 일관된 스타일과 품질을 보장합니다.

## 하네스에 포함되어야 할 요소
1. **비주얼 스타일** — 색감 (예: 따뜻한 톤, 블루 계열), 조명 스타일, 전체 무드
2. **카메라 스타일** — 선호 앵글, 움직임 (돌리, 팬, 고정 등)
3. **톤앤매너** — 프리미엄/캐주얼/감성적/유머 등
4. **타겟 오디언스** — 연령대, 관심사
5. **브랜드 키워드** — 핵심 메시지, 금지어, 필수 포함 요소
6. **프롬프트 프리픽스** — 모든 이미지 프롬프트 앞에 붙을 영어 스타일 지침
7. **참고 레퍼런스** — 참고할 영상/이미지 스타일 설명

## 대화 가이드
1. 브리프를 분석하고 부족한 요소를 **자연스럽게** 질문합니다
2. 한 번에 2-3개 질문만. 초보자도 편하게 대답할 수 있도록 선택지를 제시합니다
3. 대화가 진행되면서 하네스가 점점 구체화됨을 알려줍니다
4. 충분한 정보가 모이면 "하네스가 거의 완성됐어요! 확정 버튼을 눌러주세요" 안내

자연스럽고 전문적인 한국어로 대화하세요."""

FINALIZE_PROMPT = """지금까지의 대화를 바탕으로 **하네스 + 스크립트 + 씬 분할**을 완성하세요.
정보가 부족하면 합리적으로 추정. 절대 질문하지 말고 JSON만 출력.

{"harness": {"visual_style": "전체 비주얼 스타일 설명 (영어)", "color_palette": "색감 (영어, 예: warm golden tones)", "camera_style": "카메라 스타일 (영어)", "tone": "톤앤매너 (한국어)", "target_audience": "타겟 (한국어)", "brand_keywords": ["핵심 키워드"], "prompt_prefix": "모든 이미지 프롬프트 앞에 붙을 영어 스타일 지침 (예: cinematic, warm lighting, premium feel, shallow depth of field)", "banned_words": ["금지어"]}, "script": "전체 스크립트", "scenes": [{"title": "씬 제목", "prompt": "영어 이미지 프롬프트 (prompt_prefix 스타일 반영)", "duration_sec": 3.0}]}

규칙:
- prompt에 harness.prompt_prefix 스타일을 자연스럽게 반영
- 영어 프롬프트에 구도/조명/색감/카메라 구체적으로
- 최소 3개, 최대 6개 씬
- JSON 외 텍스트 절대 금지"""

MOCK_CHAT_RESPONSES = [
    "안녕하세요! 브리프를 확인했습니다. 몇 가지 여쭤볼게요.\n\n1. **타겟 오디언스**가 구체적으로 어떤 분들인가요? (연령대, 관심사)\n2. **영상 길이**는 어느 정도를 생각하고 계신가요? (15초, 30초, 60초)\n3. **톤앤매너**는 어떤 느낌이면 좋을까요? (프리미엄, 친근한, 유머러스, 감성적 등)\n\n이 정보를 바탕으로 초안을 잡아보겠습니다!",
    "좋습니다! 말씀해주신 내용을 바탕으로 영상 구성 초안을 제안드립니다.\n\n**📋 영상 구성안**\n\n**씬 1 - 오프닝 (3초)**\n세련된 배경 위에 제품/브랜드가 서서히 등장. 주목도를 확보하는 임팩트 있는 비주얼.\n\n**씬 2 - 핵심 메시지 (4초)**\n제품/서비스의 핵심 가치를 시각적으로 전달. 클로즈업과 함께 핵심 카피.\n\n**씬 3 - 기능/장점 (5초)**\n구체적인 기능이나 장점을 인포그래픽 스타일로 보여줌.\n\n**씬 4 - CTA (3초)**\n브랜드 로고와 함께 행동 유도 문구.\n\n이 구성에 대해 어떻게 생각하시나요? 수정하고 싶은 부분이 있으면 말씀해주세요!",
    "네, 좋은 피드백이에요! 말씀하신 대로 수정하겠습니다.\n\n수정된 구성이 마음에 드시면 **'기획 확정'** 버튼을 눌러주세요. 그러면 각 씬의 키 이미지 생성으로 넘어갑니다.",
]

MOCK_FINALIZE_RESPONSE = json.dumps(
    {
        "script": "# 제품 소개 영상 스크립트\n\n## 씬 1: 오프닝 (3초)\n세련된 블루 톤 배경 위에 제품이 서서히 등장합니다.\n나레이션: \"혁신은 여기서 시작됩니다.\"\n\n## 씬 2: 제품 클로즈업 (4초)\n제품의 디테일을 부드러운 카메라 무빙으로 보여줍니다.\n나레이션: \"완벽한 디자인, 놀라운 성능.\"\n\n## 씬 3: 기능 시연 (5초)\n핵심 기능을 시각적으로 보여주는 인포그래픽 오버레이.\n나레이션: \"당신의 일상을 한 단계 업그레이드하세요.\"\n\n## 씬 4: 클로징 (3초)\n브랜드 로고와 함께 CTA 문구가 표시됩니다.\n나레이션: \"지금 만나보세요.\"",
        "scenes": [
            {
                "title": "오프닝 - 제품 등장",
                "prompt": "Elegant product reveal on deep blue gradient background, cinematic lighting, slow dolly in, premium feel, soft volumetric light rays, 4K quality, professional product photography",
                "duration_sec": 3.0,
            },
            {
                "title": "제품 클로즈업",
                "prompt": "Extreme close-up of modern tech product details, smooth camera orbit 360 degrees, soft studio lighting with rim light, macro lens bokeh effect, premium product photography, dark background",
                "duration_sec": 4.0,
            },
            {
                "title": "기능 시연",
                "prompt": "Product in use in modern lifestyle setting, dynamic floating infographic UI elements around the product, bright and energetic mood, warm natural lighting, shallow depth of field",
                "duration_sec": 5.0,
            },
            {
                "title": "클로징 - CTA",
                "prompt": "Minimalist brand logo centered on deep blue gradient background, elegant typography animation, subtle golden particle effects, premium and clean aesthetic, call to action text",
                "duration_sec": 3.0,
            },
        ],
    },
    ensure_ascii=False,
)


class LLMGateway(ModelProvider):
    def __init__(self):
        self.mode = settings.AI_MODE

    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        if self.mode == "mock":
            return await self._mock_generate(request)
        return await self._live_generate(request)

    async def chat(self, messages: list[dict], system: str | None = None) -> str:
        """Multi-turn conversation with Claude."""
        if self.mode == "mock":
            return await self._mock_chat(messages)
        return await self._live_chat(messages, system)

    async def finalize(self, messages: list[dict]) -> str:
        """Extract final script + scenes from conversation."""
        if self.mode == "mock":
            return MOCK_FINALIZE_RESPONSE

        finalize_messages = messages + [
            {"role": "user", "content": FINALIZE_PROMPT}
        ]
        return await self._live_chat(finalize_messages, SYSTEM_PROMPT)

    async def _mock_chat(self, messages: list[dict]) -> str:
        user_count = sum(1 for m in messages if m["role"] == "user")
        idx = min(user_count - 1, len(MOCK_CHAT_RESPONSES) - 1)
        return MOCK_CHAT_RESPONSES[idx]

    async def _mock_generate(self, request: GenerateRequest) -> GenerateResponse:
        return GenerateResponse(
            content=f"Mock LLM response for: {request.prompt[:100]}",
            model_id=request.model_id,
            usage={"mock": True},
        )

    async def _live_chat(self, messages: list[dict], system: str | None = None) -> str:
        import httpx

        body: dict = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 4096,
            "messages": messages,
        }
        if system:
            body["system"] = system

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=body,
                timeout=60.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"]

    async def _live_generate(self, request: GenerateRequest) -> GenerateResponse:
        result = await self._live_chat(
            [{"role": "user", "content": request.prompt}],
            SYSTEM_PROMPT,
        )
        return GenerateResponse(content=result, model_id=request.model_id)

    def get_capabilities(self) -> dict:
        return {
            "id": "claude-sonnet-4",
            "provider": "anthropic",
            "capabilities": ["scripting", "scene_split", "chat_planning"],
        }


llm_gateway = LLMGateway()
