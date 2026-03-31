from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    title: str
    brief: str
    mode: str = "director"
    llm_model: str = "claude-sonnet-4"
    image_model: str = "flux-pro"
    video_model: str = "kling-3.0-pro"


class ProjectUpdate(BaseModel):
    title: str | None = None
    brief: str | None = None
    script: str | None = None
    llm_model: str | None = None
    image_model: str | None = None
    video_model: str | None = None


class SceneOut(BaseModel):
    id: str
    project_id: str
    order_index: int
    title: str
    description: str
    script_formatted: str
    prompt: str
    duration_sec: float
    key_image_url: str | None
    video_url: str | None
    status: str
    image_model_used: str | None
    video_model_used: str | None
    transition: str
    subtitles_json: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectOut(BaseModel):
    id: str
    title: str
    brief: str
    mode: str
    status: str
    script: str | None
    synopsis_data: str | None
    harness: str | None
    llm_model: str
    image_model: str
    video_model: str
    created_at: datetime
    updated_at: datetime
    scenes: list[SceneOut] = []

    model_config = {"from_attributes": True}


class ProjectListOut(BaseModel):
    id: str
    title: str
    brief: str
    mode: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
