import API from '../utils/api';

export const eventService = {
  getEvents: async () => {
    const response = await API.get('/events');
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
  }
};
