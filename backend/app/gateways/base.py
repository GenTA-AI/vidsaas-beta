from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class GenerateRequest:
    prompt: str
    model_id: str
    params: dict | None = None


@dataclass
class GenerateResponse:
    content: str
    model_id: str
    usage: dict | None = None


class ModelProvider(ABC):
    @abstractmethod
    async def generate(self, request: GenerateRequest) -> GenerateResponse:
        pass

    @abstractmethod
    def get_capabilities(self) -> dict:
        pass
