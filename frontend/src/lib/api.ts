const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Resolve asset URLs (handle both /uploads/... and full URLs)
export function assetUrl(url: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

// Types
export interface Project {
  id: string;
  title: string;
  brief: string;
  mode: string;
  status: string;
  script: string | null;
  synopsis_data: string | null;
  harness: string | null;
  llm_model: string;
  image_model: string;
  video_model: string;
  created_at: string;
  updated_at: string;
  scenes: Scene[];
}

export interface Scene {
  id: string;
  project_id: string;
  order_index: number;
  title: string;
  description: string;
  script_formatted: string;
  prompt: string;
  duration_sec: number;
  key_image_url: string | null;
  video_url: string | null;
  status: string;
  image_model_used: string | null;
  video_model_used: string | null;
  transition: string;
  subtitles_json: string;
  error_message: string | null;
  created_at: string;
}

export interface RefineResult {
  script_formatted: string;
  prompt: string;
  title: string;
}

export interface ReferenceImage {
  id: string;
  project_id: string;
  category: string;
  label: string;
  prompt: string;
  image_url: string | null;
  created_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  label: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface PipelineStatus {
  project_id: string;
  project_status: string;
  run_id: string | null;
  run_status: string | null;
  current_stage: string | null;
  scenes: {
    id: string;
    order_index: number;
    title: string;
    status: string;
    key_image_url: string | null;
    video_url: string | null;
  }[];
}

// API functions
export const api = {
  listProjects: () => request<Project[]>("/api/v1/projects"),

  createProject: (data: { title: string; brief: string }) =>
    request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ ...data, mode: "director" }),
    }),

  importSynopsis: (synopsis_text: string, title?: string) =>
    request<Project>("/api/v1/projects/import-synopsis", {
      method: "POST",
      body: JSON.stringify({ synopsis_text, title }),
    }),

  getProject: (id: string) => request<Project>(`/api/v1/projects/${id}`),

  deleteProject: (id: string) =>
    request<void>(`/api/v1/projects/${id}`, { method: "DELETE" }),

  // Chat (대화형 기획)
  getChatHistory: (id: string) =>
    request<ChatMessage[]>(`/api/v1/projects/${id}/chat`),

  sendChatMessage: (id: string, message: string) =>
    request<{ user_message: ChatMessage; assistant_message: ChatMessage; has_proposal: boolean; proposal: Record<string, unknown> | null }>(
      `/api/v1/projects/${id}/chat`,
      { method: "POST", body: JSON.stringify({ message }) }
    ),

  applyChanges: (id: string, changes: Record<string, unknown>[]) =>
    request<{ message: string; applied: number }>(
      `/api/v1/projects/${id}/chat/apply`,
      { method: "POST", body: JSON.stringify({ changes }) }
    ),

  finalizePlanning: (id: string) =>
    request<{ script: string; scenes: { title: string; prompt: string; duration_sec: number }[] }>(
      `/api/v1/projects/${id}/chat/finalize`,
      { method: "POST" }
    ),

  // Pipeline
  getPipelineStatus: (id: string) =>
    request<PipelineStatus>(`/api/v1/projects/${id}/pipeline/status`),

  approveScenes: (id: string) =>
    request<{ message: string }>(`/api/v1/projects/${id}/scenes/approve`, {
      method: "POST",
    }),

  approveScene: (projectId: string, sceneId: string) =>
    request<{ message: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/approve`,
      { method: "POST" }
    ),

  approveAllImages: (id: string) =>
    request<{ message: string }>(`/api/v1/projects/${id}/images/approve`, {
      method: "POST",
    }),

  regenerateImage: (projectId: string, sceneId: string, referenceUrls: string[] = []) =>
    request<{ message: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/regenerate-image`,
      { method: "POST", body: JSON.stringify({ reference_urls: referenceUrls }) }
    ),

  uploadImage: async (projectId: string, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/upload-image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  regenerateVideo: (projectId: string, sceneId: string) =>
    request<{ message: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/regenerate-video`,
      { method: "POST" }
    ),

  generatePrompt: (projectId: string, sceneId: string, userRequest: string) =>
    request<{ prompt: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/generate-prompt`,
      { method: "POST", body: JSON.stringify({ request: userRequest }) }
    ),

  generateImageWithRequest: (projectId: string, sceneId: string, userRequest: string) =>
    request<{ message: string; prompt: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/generate-image-with-request`,
      { method: "POST", body: JSON.stringify({ request: userRequest }) }
    ),

  updateHarness: (projectId: string, harness: Record<string, unknown>) =>
    request<{ message: string }>(`/api/v1/projects/${projectId}/harness`, {
      method: "PUT",
      body: JSON.stringify({ harness }),
    }),

  updateHarnessWithChat: (projectId: string, userRequest: string) =>
    request<{ message: string; harness: Record<string, unknown> }>(
      `/api/v1/projects/${projectId}/harness/chat`,
      { method: "POST", body: JSON.stringify({ request: userRequest }) }
    ),

  refineScene: (projectId: string, sceneId: string, description: string) =>
    request<RefineResult>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/refine`,
      { method: "POST", body: JSON.stringify({ description }) }
    ),

  saveSceneClip: (projectId: string, sceneId: string) =>
    request<{ message: string; output_dir: string }>(
      `/api/v1/projects/${projectId}/scenes/${sceneId}/save`,
      { method: "POST" }
    ),

  completeProject: (id: string) =>
    request<{ message: string; output_dir: string }>(
      `/api/v1/projects/${id}/complete`,
      { method: "POST" }
    ),

  openFolder: (projectId: string, path: string) =>
    request<{ message: string }>(`/api/v1/projects/${projectId}/open-folder`, {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  // References
  listReferences: (projectId: string) =>
    request<ReferenceImage[]>(`/api/v1/projects/${projectId}/references`),

  createReference: (projectId: string, data: { category: string; label: string; prompt: string }) =>
    request<ReferenceImage>(`/api/v1/projects/${projectId}/references`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteReference: (projectId: string, refId: string) =>
    request<void>(`/api/v1/projects/${projectId}/references/${refId}`, {
      method: "DELETE",
    }),

  // Versions
  listVersions: (projectId: string) =>
    request<ProjectVersion[]>(`/api/v1/projects/${projectId}/versions`),

  saveVersion: (projectId: string, label: string) =>
    request<ProjectVersion>(`/api/v1/projects/${projectId}/versions`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  restoreVersion: (projectId: string, versionId: string) =>
    request<{ message: string }>(`/api/v1/projects/${projectId}/versions/${versionId}/restore`, {
      method: "POST",
    }),

  deleteVersion: (projectId: string, versionId: string) =>
    request<void>(`/api/v1/projects/${projectId}/versions/${versionId}`, {
      method: "DELETE",
    }),

  // Scenes
  reorderScenes: (projectId: string, sceneIds: string[]) =>
    request<{ message: string }>(`/api/v1/projects/${projectId}/scenes/reorder`, {
      method: "PUT",
      body: JSON.stringify({ scene_ids: sceneIds }),
    }),

  addScene: (projectId: string, title: string, afterIndex: number) =>
    request<Scene>(`/api/v1/projects/${projectId}/scenes`, {
      method: "POST",
      body: JSON.stringify({ title, after_index: afterIndex }),
    }),

  deleteScene: (projectId: string, sceneId: string) =>
    request<void>(`/api/v1/projects/${projectId}/scenes/${sceneId}`, {
      method: "DELETE",
    }),

  updateScene: (projectId: string, sceneId: string, data: { prompt?: string; title?: string; subtitles_json?: string; transition?: string }) =>
    request<Scene>(`/api/v1/projects/${projectId}/scenes/${sceneId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
