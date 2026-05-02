import API from '../utils/api';

export const authService = {
  login: async (credentials) => {
    const response = await API.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await API.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await API.get('/auth/me');
    return response.data;
  }
};
