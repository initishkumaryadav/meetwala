import axios from "axios";
import { useAuthStore } from "../store/auth.store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 120000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

// ── API helpers ───────────────────────────────────────
export const meetingApi = {
  create: (data)       => api.post("/meetings", data),
  list:   ()           => api.get("/meetings"),
  get:    (roomCode)   => api.get(`/meetings/${roomCode}`),
  join:   (roomCode)   => api.get(`/meetings/join/${roomCode}`),
  start:  (id)         => api.patch(`/meetings/${id}/start`),
  end:    (id)         => api.patch(`/meetings/${id}/end`),
  downloadSummaryPdf: (roomCode) => api.get(`/meetings/${roomCode}/summary-pdf`, { responseType: "blob" }),
};

export const proxyApi = {
  create:     (data) => api.post("/proxy", data),
  listMine:   ()     => api.get("/proxy/my"),
  get:        (id)   => api.get(`/proxy/${id}`),
  setStatus:  (id, status) => api.patch(`/proxy/${id}/status`, { status }),
  activate:   (id)   => api.post(`/proxy/${id}/activate`),
  deactivate: (id)   => api.post(`/proxy/${id}/deactivate`),
};

export const briefingApi = {
  save: (data) => api.post("/briefings", data),
  get:  (proxySessionId) => api.get(`/briefings/${proxySessionId}`),
  upload: (proxySessionId, files) => {
    const form = new FormData();
    form.append("proxySessionId", proxySessionId);
    for (const file of files) form.append("files", file);
    return api.post("/briefings/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    });
  },
  chat: (data) => api.post("/briefings/chat", data),
  finalize: (data) => api.post("/briefings/finalize", data),
};

export const authApi = {
  me: () => api.get("/auth/me"),
};