import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { FaPaperPlane, FaTrash, FaUsers, FaBookOpen, FaPencilAlt, FaCalendarAlt } from 'react-icons/fa';
import API from '../utils/api';
import { eventService } from '../services/eventService';
import { socketService } from '../services/socketService';
import { EVENT_CATEGORIES } from '../utils/categories';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import './EventFormPanel.css';

// Fix for Leaflet default icon issues in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition, onAddressFound, disabled }) {
  const timeoutRef = useRef(null);

  const map = useMapEvents({
    click(e) {
      if (disabled) return;
      const { lat, lng } = e.latlng;
      setPosition(lat, lng);
      
      // Clear existing timeout to debounce
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        // Reverse Geocoding via Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
          headers: { 'Accept-Language': 'uk,en' }
        })
          .then(res => res.ok ? res.json() : Promise.reject())
          .then(data => {
            if (data && data.display_name) onAddressFound(data.display_name);
          })
          .catch(err => {
            console.error('Geocoding error:', err);
            onAddressFound(null);
          });
      }, 500); // 500ms delay
    },
  });

  return position ? <Marker position={position} /> : null;
}

export default function EventFormPanel({
  selectedEvent,
  currentUser,
  isModerator,
  formData,
  formError,
  submitting,
  isEditMode,
  hasEventAccess,
  handleFormChange,
  handleCreateEvent,
  handleDeleteEvent,
  onClose,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleJoinEvent,
  handleLeaveEvent
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [suggestedAddress, setSuggestedAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState({ show: false, userId: null, userName: '' });
  const [showMessageDeleteConfirm, setShowMessageDeleteConfirm] = useState({ show: false, messageId: null });
  const [localParticipants, setLocalParticipants] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Reset state on event change
    setActiveTab('details');
    setShowParticipants(false);
    setLocalParticipants(selectedEvent?.participants || []);
    setSuggestedAddress(null);
  }, [selectedEvent?.id]);

    // Listen for participant changes
  useEffect(() => {
    if (!selectedEvent?.id) return;
    
    socketService.connect();
    socketService.joinEvent(selectedEvent.id);

    const handleJoined = (data) => {
      if (data.eventId === selectedEvent.id && data.user) {
        setLocalParticipants(prev => {
          if (prev.some(p => p.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    };
    const handleLeft = (data) => {
      if (data.eventId === selectedEvent.id) {
        setLocalParticipants(prev => prev.filter(p => p.id !== data.userId));
      }
    };

    socketService.onParticipantJoined(handleJoined);
    socketService.onParticipantLeft(handleLeft);

    return () => {
      socketService.offParticipantJoined(handleJoined);
      socketService.offParticipantLeft(handleLeft);
    };
  }, [selectedEvent?.id]);

  useEffect(() => {
    if (activeTab === 'chat' && selectedEvent?.id) {
      socketService.connect();
      socketService.joinEvent(selectedEvent.id);

      const handleNewMessage = (msg) => {
        setMessages(prev => [...prev, msg]);
      };

      socketService.onNewMessage(handleNewMessage);

      // Listen for message deletions
      const handleMessageDeleted = (data) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      };
      socketService.onMessageDeleted(handleMessageDeleted);

      // Listen for participant join/leave
      const handleParticipantJoined = (data) => {
        if (data.eventId === selectedEvent.id && data.user) {
          setLocalParticipants(prev => {
            if (prev.some(p => p.id === data.user.id)) return prev;
            return [...prev, data.user];
          });
        }
      };
      const handleParticipantLeft = (data) => {
        if (data.eventId === selectedEvent.id) {
          setLocalParticipants(prev => prev.filter(p => p.id !== data.userId));
        }
      };
      socketService.onParticipantJoined(handleParticipantJoined);
      socketService.onParticipantLeft(handleParticipantLeft);

      // Load history
      eventService.getEventMessages(selectedEvent.id)
        .then(setMessages)
        .catch(err => console.error("Error loading messages:", err));

      return () => {
        socketService.leaveEvent(selectedEvent.id);
        socketService.offNewMessage(handleNewMessage);
        socketService.offMessageDeleted(handleMessageDeleted);
        socketService.offParticipantJoined(handleParticipantJoined);
        socketService.offParticipantLeft(handleParticipantLeft);
      };
    }
  }, [activeTab, selectedEvent?.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const onSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    socketService.sendMessage(selectedEvent.id, newMessage);
    setNewMessage('');
  };

  const participants = localParticipants;
  const isJoined = participants.some(p => p.id === currentUser?.id);
  const canJoin = isEditMode && !hasEventAccess && !isJoined && currentUser;

  // Sort participants: creator first
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === selectedEvent?.creator_id) return -1;
    if (b.id === selectedEvent?.creator_id) return 1;
    return 0;
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    try {
      const uploadRes = await API.post('/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const imageUrl = uploadRes.data.imageUrl;
      const fullUrl = `${API.defaults.baseURL.replace('/api', '')}${imageUrl}`;

      handleFormChange({ target: { name: 'photo_url', value: fullUrl } });
    } catch (err) {
      console.error('Event photo upload error:', err);
    }
  };

  const handleRemovePhoto = () => {
    handleFormChange({ target: { name: 'photo_url', value: null } });
  };

  const onKickParticipant = async () => {
    try {
      await API.delete(`/events/${selectedEvent.id}/participants/${showKickConfirm.userId}`);
      setShowKickConfirm({ show: false, userId: null, userName: '' });
      // Immediately update local participant list
      setLocalParticipants(prev => prev.filter(p => p.id !== showKickConfirm.userId));
    } catch (err) {
      console.error('Error kicking participant:', err);
    }
  };

  const onDeleteMessage = async () => {
    try {
      await API.delete(`/messages/${showMessageDeleteConfirm.messageId}`);
      setMessages(prev => prev.filter(m => m.id !== showMessageDeleteConfirm.messageId));
      setShowMessageDeleteConfirm({ show: false, messageId: null });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  return (
    <>
      <aside className="create-event-panel event-panel-container">
        <div className="panel-header">
          <h2>{selectedEvent ? 'Деталі заходу' : 'Створити новий захід'}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Закрити панель">✕</button>
        </div>

        {isEditMode && (
          <div className="event-tabs">
            <button 
              type="button" 
              className={clsx('event-tab-btn', activeTab === 'details' && 'active')}
              onClick={() => setActiveTab('details')}
            >
              Деталі
            </button>
            <button 
              type="button" 
              className={clsx('event-tab-btn', activeTab === 'chat' && 'active')}
              onClick={() => setActiveTab('chat')}
            >
              Чат
            </button>
          </div>
        )}

        {activeTab === 'details' && (
          <form onSubmit={handleCreateEvent} className="create-event-form event-form-scrollable">
            {isEditMode && !hasEventAccess && (
              <div className="event-view-notice">
                <div className="notice-photo">
                  {formData.photo_url ? (
                    <img src={formData.photo_url} alt="Event" />
                  ) : (
                    <FaCalendarAlt size={16} />
                  )}
                </div>
                <div>
                  <FaBookOpen className="icon-mr" /> Ви можете лише переглядати цей захід
                </div>
              </div>
            )}

            {formError && (
              <div className="form-error">
                <p>❌ {formError}</p>
              </div>
            )}

            <div className="form-group event-photo-setup">
              <label>Фото заходу</label>
              <div className="event-photo-preview-container">
                <div className="event-photo-preview">
                  {formData.photo_url ? (
                    <img src={formData.photo_url} alt="Preview" />
                  ) : (
                    <FaCalendarAlt size={40} />
                  )}
                  {(!isEditMode || hasEventAccess) && (
                    <div className="event-photo-overlay">
                      <label htmlFor="event-photo-upload" className="photo-edit-btn" title="Змінити фото">
                        <FaPencilAlt />
                      </label>
                      {formData.photo_url && (
                        <button type="button" className="photo-delete-btn" onClick={handleRemovePhoto} title="Видалити фото">
                          <FaTrash />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input 
                  id="event-photo-upload" 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handlePhotoUpload} 
                  disabled={isEditMode && !hasEventAccess}
                />
              </div>
            </div>

            <div className="form-row organizer-privacy-row">
              {isEditMode && (
                <div className="form-group organizer-group">
                  <label>Організатор</label>
                  <div className="organizer-display">
                    {selectedEvent?.creator_id === currentUser?.id 
                      ? `Ви` 
                      : `${selectedEvent?.creator_name || 'Невідомо'} (@${selectedEvent?.creator_nickname || '?'})`}
                  </div>
                </div>
              )}

              {(!isEditMode || hasEventAccess) && (
                <div className="form-group privacy-group">
                  <label htmlFor="is_private">Приватний</label>
                  <label className="toggle-switch">
                    <input type="checkbox" id="is_private" name="is_private" checked={formData.is_private} onChange={handleFormChange} className="form-input" />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="title">Назва заходу *</label>
              <input type="text" id="title" name="title" value={formData.title} onChange={handleFormChange} placeholder="Турнір Catan, Вечір ігор, тощо" required disabled={!hasEventAccess && isEditMode} className="form-input" />
            </div>
            
            <div className="form-group">
              <label htmlFor="location">Місце проведення *</label>
              <div className="location-input-wrapper">
                <input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} placeholder="Адреса або назва закладу" required disabled={!hasEventAccess && isEditMode} className="form-input" />
                  <button 
                    type="button" 
                    className="apply-suggestion-btn" 
                    disabled={!suggestedAddress || suggestedAddress === formData.location || addressLoading}
                    onClick={() => {
                      handleFormChange({ target: { name: 'location', value: suggestedAddress } });
                      setSuggestedAddress(null);
                    }}
                    title={suggestedAddress ? `Використати адресу з мапи: ${suggestedAddress}` : 'Клацніть на мапу, щоб отримати адресу'}
                  >
                    {addressLoading ? 'Пошук...' : 'Взяти з мапи'}
                  </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="category">Категорія заходу</label>
              <select 
                id="category" 
                name="category" 
                value={formData.category || ''} 
                onChange={handleFormChange}
                disabled={!hasEventAccess && isEditMode}
                className="form-select"
              >
                <option value="">-- Виберіть категорию --</option>
                {EVENT_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Виберіть локацію на мапі</label>
              <div className="event-map-container">
                <MapContainer 
                  center={[formData.latitude || 50.4501, formData.longitude || 30.5234]} 
                  zoom={13} 
                  scrollWheelZoom={true}
                  className="event-map"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <LocationMarker 
                    position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null}
                    setPosition={(lat, lng) => {
                      setAddressLoading(true);
                      handleFormChange({ target: { name: 'latitude', value: lat } });
                      handleFormChange({ target: { name: 'longitude', value: lng } });
                    }}
                    onAddressFound={(address) => {
                      setAddressLoading(false);
                      if (!address) return;
                      if (!formData.location || formData.location === '') {
                        handleFormChange({ target: { name: 'location', value: address } });
                        setSuggestedAddress(null);
                      } else {
                        setSuggestedAddress(address);
                      }
                    }}
                    disabled={!hasEventAccess && isEditMode}
                  />
                </MapContainer>
              </div>
              <div className="form-row coords-display">
                <div className="coord-item">Широта: <span>{typeof formData.latitude === 'number' ? formData.latitude.toFixed(4) : (Number(formData.latitude) ? Number(formData.latitude).toFixed(4) : '—')}</span></div>
                <div className="coord-item">Довгота: <span>{typeof formData.longitude === 'number' ? formData.longitude.toFixed(4) : (Number(formData.longitude) ? Number(formData.longitude).toFixed(4) : '—')}</span></div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="event_date">Дата та час *</label>
              <input type="datetime-local" id="event_date" name="event_date" value={formData.event_date} onChange={handleFormChange} required disabled={!hasEventAccess && isEditMode} className="form-input" />
            </div>

            <div className="form-group">
              <label htmlFor="max_participants">Максимальна кількість учасників</label>
              <input type="number" id="max_participants" name="max_participants" value={formData.max_participants} onChange={handleFormChange} placeholder="16" min="1" disabled={!hasEventAccess && isEditMode} className="form-input" />
            </div>


            <div className="form-actions event-form-actions">
              <button type="button" className="button button-secondary" onClick={onClose}>
                {selectedEvent ? 'Закрити' : 'Скасувати'}
              </button>

              {isEditMode && (selectedEvent?.creator_id === currentUser?.id || isModerator) && (
                <button type="button" className="button button-danger" onClick={() => setShowDeleteConfirm(true)} title="Видалити захід">
                  <FaTrash />
                </button>
              )}

              {canJoin && (
                <button type="button" className="button button-primary" onClick={() => handleJoinEvent(selectedEvent.id)} disabled={submitting}>
                  {submitting ? 'Обробка...' : 'Приєднатися'}
                </button>
              )}

              {isJoined && selectedEvent?.creator_id !== currentUser?.id && (
                <button type="button" className="button button-danger" onClick={() => handleLeaveEvent(selectedEvent.id)} disabled={submitting}>
                  {submitting ? 'Обробка...' : 'Покинути'}
                </button>
              )}

              {(!isEditMode || hasEventAccess) && (
                <button type="submit" className="button button-primary" disabled={submitting}>
                  {submitting ? (selectedEvent ? 'Збереження...' : 'Створення...') : (selectedEvent ? 'Зберегти' : 'Створити захід')}
                </button>
              )}
            </div>
          </form>
        )}

        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="chat-header-bar">
              <div className="chat-header-info">
                <div className="chat-header-avatar">
                  {selectedEvent.photo_url ? (
                    <img src={selectedEvent.photo_url} alt="Event" />
                  ) : (
                    <FaCalendarAlt size={16} />
                  )}
                </div>
                <span className="chat-header-name">{selectedEvent.title}</span>
              </div>
              <button 
                className="chat-participants-toggle-btn"
                onClick={() => setShowParticipants(!showParticipants)}
                title="Учасники"
              >
                <FaUsers size={14} />
                <span>{participants.length}</span>
              </button>
            </div>

            {showParticipants && (
              <div className="chat-participants-dropdown">
                <div className="chat-participants-title">Учасники ({participants.length} / {selectedEvent.max_participants || '∞'})</div>
                {sortedParticipants.map(p => (
                  <div key={p.id} className="chat-participant-item">
                    <div className="chat-participant-avatar" style={{ background: p.photo_url ? 'transparent' : '#10b981' }}>
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.full_name} />
                      ) : (
                        p.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="chat-participant-info">
                      <span className="chat-participant-name">{p.full_name}</span>
                      <span className="chat-participant-nick">@{p.nickname}</span>
                      {p.id === selectedEvent.creator_id && (
                        <span className="participant-author-badge">Автор</span>
                      )}
                    </div>
                    {p.id !== selectedEvent.creator_id && (currentUser?.id === selectedEvent?.creator_id || isModerator) && (
                      <button 
                        className="kick-participant-btn-small" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowKickConfirm({ show: true, userId: p.id, userName: p.full_name });
                        }}
                        title="Видалити з івенту"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {sortedParticipants.length === 0 && (
                  <p className="participants-empty">Поки що немає учасників</p>
                )}
              </div>
            )}

            <div className="chat-messages-area">
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <p className="chat-empty-text">
                    Немає повідомлень.<br/>Будьте першим, хто напише!
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id} className={clsx('chat-message-wrapper', isMine ? 'chat-message-mine' : 'chat-message-theirs')}>
                      {!isMine && (
                        <div className="chat-message-sender-avatar">
                          {msg.sender_photo ? (
                            <img src={msg.sender_photo} alt={msg.sender_name} />
                          ) : (
                            <div className="avatar-placeholder">{msg.sender_name?.charAt(0).toUpperCase() || '?'}</div>
                          )}
                        </div>
                      )}
                      <div className="chat-message-content">
                        <div className="chat-message-header-line">
                          {!isMine && <div className="chat-message-sender">{msg.sender_name}</div>}
                          {(isMine || currentUser?.id === selectedEvent?.creator_id || isModerator) && (
                            <button 
                              className="delete-msg-btn" 
                              onClick={() => setShowMessageDeleteConfirm({ show: true, messageId: msg.id })}
                              title="Видалити повідомлення"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className={clsx('chat-message-bubble', isMine ? 'mine' : 'theirs')}>
                          {msg.text}
                        </div>
                        <div className={clsx('chat-message-time', isMine && 'mine')}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {(isJoined || hasEventAccess) ? (
              <form onSubmit={onSendMessage} className="chat-input-area">
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder="Написати повідомлення..." 
                  className="chat-input-field"
                />
                <button type="submit" className="button button-primary chat-send-btn">
                  <FaPaperPlane />
                </button>
              </form>
            ) : (
              <div className="chat-join-prompt">
                <strong>Приєднайтеся до заходу</strong>, щоб читати та писати повідомлення в чаті.
              </div>
            )}
          </div>
        )}
      </aside>
      
      {showDeleteConfirm && (
        <div className="delete-confirm-modal">
          <div className="delete-confirm-content">
            <h3>Видалити захід?</h3>
            <p>Ви впевнені, що хочете видалити захід <strong>{selectedEvent?.title}</strong>?</p>
            <p className="delete-confirm-warning">Ця дія не може бути скасована.</p>
            <div className="delete-confirm-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={submitting}>Скасувати</button>
              <button type="button" className="button button-danger" onClick={handleDeleteEvent} disabled={submitting}>
                {submitting ? 'Видалення...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showKickConfirm.show && (
        <div className="delete-confirm-modal" onClick={() => setShowKickConfirm({ show: false, userId: null, userName: '' })}>
          <div className="delete-confirm-content" onClick={e => e.stopPropagation()}>
            <h3>Видалити з івенту?</h3>
            <p>Ви впевнені, що хочете видалити <strong>{showKickConfirm.userName}</strong> з цього заходу?</p>
            <div className="delete-confirm-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowKickConfirm({ show: false, userId: null, userName: '' })}>Скасувати</button>
              <button type="button" className="button button-danger" onClick={onKickParticipant}>Видалити</button>
            </div>
          </div>
        </div>
      )}

      {showMessageDeleteConfirm.show && (
        <div className="delete-confirm-modal" onClick={() => setShowMessageDeleteConfirm({ show: false, messageId: null })}>
          <div className="delete-confirm-content" onClick={e => e.stopPropagation()}>
            <h3>Видалити повідомлення?</h3>
            <p>Ви впевнені, що хочете видалити це повідомлення? Цю дію неможливо скасувати.</p>
            <div className="delete-confirm-actions">
              <button type="button" className="button button-secondary" onClick={() => setShowMessageDeleteConfirm({ show: false, messageId: null })}>Скасувати</button>
              <button type="button" className="button button-danger" onClick={onDeleteMessage}>Видалити</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
