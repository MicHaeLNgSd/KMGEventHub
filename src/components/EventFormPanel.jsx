import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { FaPaperPlane, FaTrash, FaUsers, FaBookOpen } from 'react-icons/fa';
import { eventService } from '../services/eventService';
import { socketService } from '../services/socketService';
import { EVENT_CATEGORIES } from '../utils/categories';
import './EventFormPanel.css';

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
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Reset tab when opening a different event
    setActiveTab('details');
    setShowParticipants(false);
  }, [selectedEvent?.id]);

  useEffect(() => {
    if (activeTab === 'chat' && selectedEvent?.id) {
      // Connect and join event room
      socketService.connect();
      socketService.joinEvent(selectedEvent.id);

      const handleNewMessage = (msg) => {
        setMessages(prev => [...prev, msg]);
      };

      socketService.onNewMessage(handleNewMessage);

      // Load history
      eventService.getEventMessages(selectedEvent.id)
        .then(setMessages)
        .catch(err => console.error("Error loading messages:", err));

      return () => {
        socketService.leaveEvent(selectedEvent.id);
        socketService.offNewMessage(handleNewMessage);
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

  const participants = selectedEvent?.participants || [];
  const isJoined = participants.some(p => p.id === currentUser?.id);
  const canJoin = isEditMode && !hasEventAccess && !isJoined && currentUser;

  // Sort participants: creator first
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === selectedEvent?.creator_id) return -1;
    if (b.id === selectedEvent?.creator_id) return 1;
    return 0;
  });

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
                <FaBookOpen className="icon-mr" /> Ви можете лише переглядати цей захід
              </div>
            )}

            {formError && (
              <div className="form-error">
                <p>❌ {formError}</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="title">Назва заходу *</label>
              <input type="text" id="title" name="title" value={formData.title} onChange={handleFormChange} placeholder="Турнір Catan, Вечір ігор, тощо" required disabled={!hasEventAccess && isEditMode} className="form-input" />
            </div>
            
            <div className="form-group">
              <label htmlFor="location">Місце проведення *</label>
              <input type="text" id="location" name="location" value={formData.location} onChange={handleFormChange} placeholder="Адреса або назва закладу" required disabled={!hasEventAccess && isEditMode} className="form-input" />
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="latitude">Широта</label>
                <input type="number" id="latitude" name="latitude" value={formData.latitude} onChange={handleFormChange} placeholder="50.4501" step="0.0001" disabled={!hasEventAccess && isEditMode} className="form-input" />
              </div>
              <div className="form-group">
                <label htmlFor="longitude">Довгота</label>
                <input type="number" id="longitude" name="longitude" value={formData.longitude} onChange={handleFormChange} placeholder="30.5234" step="0.0001" disabled={!hasEventAccess && isEditMode} className="form-input" />
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

            {(!isEditMode || hasEventAccess) && (
              <div className="form-group event-private-toggle">
                <label htmlFor="is_private" style={{ margin: 0 }}>Приватний захід</label>
                <label className="toggle-switch">
                  <input type="checkbox" id="is_private" name="is_private" checked={formData.is_private} onChange={handleFormChange} className="form-input" />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            )}

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
            <div 
              className="chat-header-bar" 
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <FaUsers className="icon-mr" /> Учасників: {participants.length} / {selectedEvent.max_participants || '∞'} 
              <span className="chat-header-subtitle">
                {showParticipants ? '▲ Сховати перелік' : '▼ Показати перелік'}
              </span>
            </div>

            {showParticipants && (
              <div className="chat-participants-modal">
                <ul className="participants-list-ul">
                  {sortedParticipants.map(p => (
                    <li key={p.id} className="participant-item">
                      <div className="participant-avatar">
                        {p.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="participant-info">
                        <div className="participant-name">{p.full_name}</div>
                        <div className="participant-nickname">@{p.nickname}</div>
                      </div>
                      {p.id === selectedEvent.creator_id && (
                        <span className="participant-author-badge">Автор</span>
                      )}
                    </li>
                  ))}
                  {sortedParticipants.length === 0 && (
                    <p className="participants-empty">Поки що немає учасників</p>
                  )}
                </ul>
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
                      {!isMine && <div className="chat-message-sender">{msg.sender_name}</div>}
                      <div className={clsx('chat-message-bubble', isMine ? 'mine' : 'theirs')}>
                        {msg.text}
                      </div>
                      <div className={clsx('chat-message-time', isMine && 'mine')}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
    </>
  );
}
