import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://code-reviewer-backend-yxx4.onrender.com/api/v1',
});

// Automatically attach JWT token to protected requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== AUTHENTICATION ====================

export const authAPI = {
  login: (data) => apiClient.post('/auth/login', data),

  register: (data) => apiClient.post('/auth/register', data),

  getMe: () => apiClient.get('/auth/me'),
};

// ==================== CP DASHBOARD ====================

export const cpAPI = {
  getStats: () => apiClient.get('/cp2/dashboard-stats'),

  syncHandles: (data) => apiClient.post('/cp2/sync-handles', data),
};

export default apiClient;
