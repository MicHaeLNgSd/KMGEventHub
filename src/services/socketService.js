import { io } from 'socket.io-client';
import API from '../utils/api';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    if (this.socket) {
      this.socket.disconnect();
    }

    const baseURL = API.defaults.baseURL.replace('/api', '') || 'http://localhost:3000';

    this.socket = io(baseURL, {
      auth: { token }
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinEvent(eventId) {
    if (this.socket) {
      this.socket.emit('joinEvent', eventId);
    }
  }

  leaveEvent(eventId) {
    if (this.socket) {
      this.socket.emit('leaveEvent', eventId);
    }
  }

  sendMessage(eventId, text) {
    if (this.socket) {
      this.socket.emit('sendMessage', { eventId, text });
    }
  }

  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('newMessage', callback);
    }
  }

  offNewMessage(callback) {
    if (this.socket) {
      this.socket.off('newMessage', callback);
    }
  }

  joinDirectChat(friendId) {
    if (this.socket) {
      this.socket.emit('joinDirectChat', friendId);
    }
  }

  leaveDirectChat(friendId) {
    if (this.socket) {
      this.socket.emit('leaveDirectChat', friendId);
    }
  }

  sendDirectMessage(receiverId, text) {
    if (this.socket) {
      this.socket.emit('sendDirectMessage', { receiverId, text });
    }
  }

  onNewDirectMessage(callback) {
    if (this.socket) {
      this.socket.on('newDirectMessage', callback);
    }
  }

  offNewDirectMessage(callback) {
    if (this.socket) {
      this.socket.off('newDirectMessage', callback);
    }
  }

  joinPersonalRoom(userId) {
    if (this.socket) {
      this.socket.emit('joinPersonalRoom', userId);
    }
  }

  onChatListUpdate(callback) {
    if (this.socket) {
      this.socket.on('chatListUpdate', callback);
    }
  }

  offChatListUpdate(callback) {
    if (this.socket) {
      this.socket.off('chatListUpdate', callback);
    }
  }

  onMessageError(callback) {
    if (this.socket) {
      this.socket.on('messageError', callback);
    }
  }

  offMessageError(callback) {
    if (this.socket) {
      this.socket.off('messageError', callback);
    }
  }
}

export const socketService = new SocketService();
