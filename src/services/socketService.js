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

  onFriendRequestReceived(callback) { if (this.socket) this.socket.on('friendRequestReceived', callback); }
  offFriendRequestReceived(callback) { if (this.socket) this.socket.off('friendRequestReceived', callback); }

  onFriendRequestAccepted(callback) { if (this.socket) this.socket.on('friendRequestAccepted', callback); }
  offFriendRequestAccepted(callback) { if (this.socket) this.socket.off('friendRequestAccepted', callback); }

  onFriendRemoved(callback) { if (this.socket) this.socket.on('friendRemoved', callback); }
  offFriendRemoved(callback) { if (this.socket) this.socket.off('friendRemoved', callback); }

  onUserBlocked(callback) { if (this.socket) this.socket.on('userBlocked', callback); }
  offUserBlocked(callback) { if (this.socket) this.socket.off('userBlocked', callback); }

  onUserUnblocked(callback) { if (this.socket) this.socket.on('userUnblocked', callback); }
  offUserUnblocked(callback) { if (this.socket) this.socket.off('userUnblocked', callback); }

  onAccountBanned(callback) { if (this.socket) this.socket.on('accountBanned', callback); }
  offAccountBanned(callback) { if (this.socket) this.socket.off('accountBanned', callback); }

  onEventDeleted(callback) { if (this.socket) this.socket.on('eventDeleted', callback); }
  offEventDeleted(callback) { if (this.socket) this.socket.off('eventDeleted', callback); }

  onEventUpdated(callback) { if (this.socket) this.socket.on('eventUpdated', callback); }
  offEventUpdated(callback) { if (this.socket) this.socket.off('eventUpdated', callback); }

  onKickedFromEvent(callback) { if (this.socket) this.socket.on('kickedFromEvent', callback); }
  offKickedFromEvent(callback) { if (this.socket) this.socket.off('kickedFromEvent', callback); }

  onMessageDeleted(callback) { if (this.socket) this.socket.on('messageDeleted', callback); }
  offMessageDeleted(callback) { if (this.socket) this.socket.off('messageDeleted', callback); }

  onParticipantJoined(callback) { if (this.socket) this.socket.on('participantJoined', callback); }
  offParticipantJoined(callback) { if (this.socket) this.socket.off('participantJoined', callback); }

  onParticipantLeft(callback) { if (this.socket) this.socket.on('participantLeft', callback); }
  offParticipantLeft(callback) { if (this.socket) this.socket.off('participantLeft', callback); }
}

export const socketService = new SocketService();
