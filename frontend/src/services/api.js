import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1',
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
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),
  getMe: () => apiClient.get('/auth/me'),
};

export const cpAPI = {
  getStats: () => apiClient.get('/cp2/dashboard-stats'),
  syncHandles: (data) => apiClient.post('/cp2/sync-handles', data),
};