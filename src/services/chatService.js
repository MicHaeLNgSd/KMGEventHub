import API from '../utils/api';

export const chatService = {
  getPersonalChats: async () => {
    const response = await API.get('/chats/personal');
    return response.data;
  },

  getDirectMessages: async (friendId) => {
    const response = await API.get(`/messages/direct/${friendId}`);
    return response.data;
  },

  getAllUsers: async () => {
    const response = await API.get('/users');
    return response.data;
  }
};
