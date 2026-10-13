// cp-dashboard api.js (+ Code Reviewer API appended at the bottom)
import axios from 'axios';

// const api = axios.create({ baseURL: 'http://127.0.0.1:8000/api/v1' });
const api = axios.create({ baseURL: 'https://code-reviewer-backend-yxx4.onrender.com/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e, fallback = 'Something went wrong. Try again.') => {
  const d = e?.response?.data;
  if (typeof d?.detail === 'string') return d.detail;
  if (Array.isArray(d?.detail)) return d.detail.map((x) => x.msg).join(', ');
  return d?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server at 127.0.0.1:8000.' : fallback);
};

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const cpApi = {
  stats: () => api.get('/cp2/dashboard-stats'),
  syncHandles: (data) => api.post('/cp2/sync-handles', data),
  // recommendations: () => api.get('/cp2/recommendations'),
  // roadmap: () => api.get('/cp2/roadmap'),
  // setNodeStatus: (nodeId, status) => api.patch(`/cp2/roadmap/${nodeId}`, { status }),
};

export const API_BASE_URL = api.defaults.baseURL;

// Code Reviewer. Axios cannot stream in the browser, so this uses fetch with the
// same Bearer token, 401 handling and errMsg-style messages as the axios instance.
export const reviewApi = {
  async stream({ code, problemDescription = '', signal, onChunk }) {
    const token = localStorage.getItem('token');
    let res;
    try {
      res = await fetch(`${API_BASE_URL}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code, problem_description: problemDescription }),
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw Object.assign(new Error(errMsg({ code: 'ERR_NETWORK' })), { status: 0 });
    }
    if (!res.ok) {
      if (res.status === 401 && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:expired'));
      }
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON error body */ }
      throw Object.assign(new Error(errMsg({ response: { data: body } }, `Review failed (${res.status}).`)), {
        status: res.status,
        retryAfter: Number(res.headers.get('Retry-After')) || 0,
      });
    }
    if (!res.body) { const t = await res.text(); onChunk?.(t); return t; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      onChunk?.(text);
    }
    return text;
  },
};

export default api;
