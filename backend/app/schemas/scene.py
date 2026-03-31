from pydantic import BaseModel


class SceneUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    script_formatted: str | None = None
    prompt: str | None = None
    duration_sec: float | None = None
    transition: str | None = None
    subtitles_json: str | None = None


class PipelineStatusOut(BaseModel):
    project_id: str
    project_status: str
    run_id: str | None = None
    run_status: str | None = None
    current_stage: str | None = None
    scenes: list["SceneStatusOut"] = []


class SceneStatusOut(BaseModel):
    id: str
    order_index: int
    title: str
    status: str
    key_image_url: str | None
    video_url: str | None

    model_config = {"from_attributes": True}
