import API from '../utils/api';

export const eventService = {
  getEvents: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const response = await API.get(`/events?${params.toString()}`);
    return response.data;
  },

  getEventById: async (eventId) => {
    const response = await API.get(`/events/${eventId}`);
    return response.data;
  },

  createEvent: async (eventData) => {
    const response = await API.post('/events', eventData);
    return response.data;
  },

  updateEvent: async (eventId, eventData) => {
    const response = await API.put(`/events/${eventId}`, eventData);
    return response.data;
  },

  deleteEvent: async (eventId) => {
    const response = await API.delete(`/events/${eventId}`);
    return response.data;
  },

  joinEvent: async (eventId) => {
    const response = await API.post(`/events/${eventId}/join`);
    return response.data;
  },

  leaveEvent: async (eventId) => {
    const response = await API.delete(`/events/${eventId}/leave`);
    return response.data;
  },

  getEventMessages: async (eventId) => {
    const response = await API.get(`/events/${eventId}/messages`);
    return response.data;
  },

  sendEventMessage: async (eventId, text) => {
    const response = await API.post(`/events/${eventId}/messages`, { text });
    return response.data;
  }
};
