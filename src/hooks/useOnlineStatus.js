import { useEffect } from 'react';
import API from '../utils/api';

export function useOnlineStatus() {
  useEffect(() => {
    const setStatus = async (isActive) => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      
      try {
        await API.put('/users/status', { is_active: isActive });
      } catch (err) {
        console.error('Failed to update status', err);
      }
    };

    const sendBeaconOffline = () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const baseURL = API.defaults.baseURL || '/api';
      const url = `${baseURL}/users/offline?token=${encodeURIComponent(token)}`;
      navigator.sendBeacon(url);
    };

    if (localStorage.getItem('authToken')) {
      setStatus(true);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setStatus(true);
      } else {
        sendBeaconOffline();
      }
    };

    const handleBeforeUnload = () => {
      sendBeaconOffline();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
