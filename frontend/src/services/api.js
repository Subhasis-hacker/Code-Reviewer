import axios from 'axios';

const api = axios.create({
    baseURL: "https://code-reviewer-backend-yxx4.onrender.com/api/v1"
});

// Auto-inject JWT token to every protected request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: (data) => apiClient.post("/api/v1/auth/login", data),
  register: (data) => apiClient.post("/api/v1/auth/register", data),
  getMe: () => apiClient.get("/api/v1/auth/me"),
};

export const cpAPI = {
  getStats: () => apiClient.get('/cp2/dashboard-stats'),
  syncHandles: (data) => apiClient.post('/cp2/sync-handles', data),
};