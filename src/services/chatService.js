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
  },

  getFriendRequests: async () => {
    const response = await API.get('/friends/requests');
    return response.data;
  },

  sendFriendRequest: async (friendId) => {
    const response = await API.post('/friends/request', { friendId });
    return response.data;
  },

  acceptFriendRequest: async (friendId) => {
    const response = await API.put('/friends/accept', { friendId });
    return response.data;
  },

  removeFriend: async (friendId) => {
    const response = await API.delete(`/friends/remove?friendId=${friendId}`);
    return response.data;
  },

  blockUser: async (friendId) => {
    const response = await API.post('/friends/block', { friendId });
    return response.data;
  },

  unblockUser: async (friendId) => {
    const response = await API.delete(`/friends/unblock?friendId=${friendId}`);
    return response.data;
  }
};
