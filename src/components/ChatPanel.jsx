import React, { useState, useEffect, useRef, useMemo } from 'react';
import clsx from 'clsx';
import { 
  FaComments, FaUsers, FaCalendarAlt, FaSearch, 
  FaChevronRight, FaChevronLeft, FaPaperPlane,
  FaUserCircle, FaInbox, FaUserPlus, FaUserMinus, 
  FaBan, FaCheck, FaTimes, FaEllipsisV, FaUserFriends
} from 'react-icons/fa';
import { FiMessageSquare } from 'react-icons/fi';
import { chatService } from '../services/chatService';
import { eventService } from '../services/eventService';
import { socketService } from '../services/socketService';
import './ChatPanel.css';

const ChatPanel = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChat, setActiveChat] = useState(null);
  
  const [personalChats, setPersonalChats] = useState([]);
  const [events, setEvents] = useState([]);
  const [people, setPeople] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [peopleFilter, setPeopleFilter] = useState('all'); // all, friends, banned
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    confirmText: 'Підтвердити',
    type: 'danger',
    action: null,
    targetId: null,
    targetName: ''
  });

  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Initial Data Loading
  useEffect(() => {
    if (!currentUser) return;
    
    if (isOpen) {
      loadTabData();
      socketService.connect();
      socketService.joinPersonalRoom(currentUser.id);
      
      const refreshList = () => loadTabData();
      socketService.onChatListUpdate(refreshList);
      
      return () => {
        socketService.offChatListUpdate(refreshList);
      };
    }
  }, [isOpen, activeTab, currentUser]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'personal') {
        const data = await chatService.getPersonalChats();
        setPersonalChats(data);
      } else if (activeTab === 'events') {
        // Fetch events joined or created by user
        const response = await eventService.getEvents({ userId: currentUser.id, joinedEvents: true });
        const myResponse = await eventService.getEvents({ userId: currentUser.id, myEvents: true });
        
        // Merge and unique
        const allEvents = [...response.events, ...myResponse.events];
        const uniqueEvents = Array.from(new Map(allEvents.map(item => [item.id, item])).values());
        setEvents(uniqueEvents);
      } else if (activeTab === 'people') {
        const data = await chatService.getAllUsers();
        setPeople(data);
      } else if (activeTab === 'requests') {
        const data = await chatService.getFriendRequests();
        setFriendRequests(data);
      }
    } catch (err) {
      console.error('Error loading chat data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Chat History Loading
  useEffect(() => {
    if (activeChat) {
      loadMessages();
      
      if (activeChat.type === 'direct') {
        socketService.joinDirectChat(activeChat.id);
        socketService.onNewDirectMessage(handleNewMessage);
      } else {
        socketService.joinEvent(activeChat.id);
        socketService.onNewMessage(handleNewMessage);
      }

      return () => {
        if (activeChat.type === 'direct') {
          socketService.leaveDirectChat(activeChat.id);
          socketService.offNewDirectMessage(handleNewMessage);
        } else {
          socketService.leaveEvent(activeChat.id);
          socketService.offNewMessage(handleNewMessage);
        }
      };
    }
  }, [activeChat]);

  const loadMessages = async () => {
    try {
      let data;
      if (activeChat.type === 'direct') {
        data = await chatService.getDirectMessages(activeChat.id);
      } else {
        data = await eventService.getEventMessages(activeChat.id);
      }
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const handleNewMessage = (msg) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    if (activeChat.type === 'direct') {
      socketService.sendDirectMessage(activeChat.id, newMessage);
    } else {
      socketService.sendMessage(activeChat.id, newMessage);
    }
    setNewMessage('');
  };

  const handleConfirm = async () => {
    const { action, targetId } = confirmModal;
    try {
      if (action === 'block') {
        await chatService.blockUser(targetId);
        if (activeChat?.id === targetId) {
          setActiveChat(null);
        }
      } else if (action === 'remove') {
        await chatService.removeFriend(targetId);
      }
      loadTabData();
    } catch (err) {
      console.error(`Error during ${action} confirmation:`, err);
    }
    setConfirmModal(prev => ({ ...prev, show: false }));
  };

  const handleFriendAction = async (action, friendId, friendName) => {
    if (action === 'block') {
      setConfirmModal({
        show: true,
        title: 'Заблокувати користувача?',
        message: `Ви впевнені, що хочете заблокувати ${friendName}? Весь ваш спільний чат буде назавжди видалено.`,
        confirmText: 'Заблокувати',
        type: 'danger',
        action: 'block',
        targetId: friendId,
        targetName: friendName
      });
      return;
    }

    if (action === 'remove') {
      setConfirmModal({
        show: true,
        title: 'Видалити з друзів?',
        message: `Ви впевнені, що хочете видалити ${friendName} зі списку друзів?`,
        confirmText: 'Видалити',
        type: 'warning',
        action: 'remove',
        targetId: friendId,
        targetName: friendName
      });
      return;
    }

    try {
      if (action === 'request') {
        await chatService.sendFriendRequest(friendId);
      } else if (action === 'accept') {
        await chatService.acceptFriendRequest(friendId);
      } else if (action === 'unblock') {
        await chatService.unblockUser(friendId);
      }
      loadTabData();
    } catch (err) {
      console.error(`Error performing friend action (${action}):`, err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filtering
  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (activeTab === 'personal') {
      return personalChats.filter(c => 
        c.friend_name.toLowerCase().includes(query) || 
        c.friend_nickname.toLowerCase().includes(query)
      );
    } else if (activeTab === 'events') {
      return events.filter(e => e.title.toLowerCase().includes(query));
    } else if (activeTab === 'people') {
      return people.filter(p => {
        const matchesQuery = p.full_name.toLowerCase().includes(query) || 
                             p.nickname.toLowerCase().includes(query);
        
        if (peopleFilter === 'friends') return matchesQuery && p.friendship_status === 'accepted';
        if (peopleFilter === 'banned') return matchesQuery && p.is_blocked_by_me;
        
        // In 'all', hide people who blocked me or who I blocked
        return matchesQuery && p.friendship_status !== 'blocked';
      });
    } else if (activeTab === 'requests') {
      return friendRequests.filter(r => 
        r.full_name.toLowerCase().includes(query) || 
        r.nickname.toLowerCase().includes(query)
      );
    }
    return [];
  }, [activeTab, searchQuery, personalChats, events, people, peopleFilter, friendRequests]);

  if (!currentUser) return null;

  return (
    <div className={clsx('chat-panel-container', isOpen ? 'open' : 'closed')}>
      <div className="chat-panel-trigger" onClick={() => setIsOpen(!isOpen)}>
        <FaChevronRight size={18} />
      </div>

      <div className="chat-panel-content">
        {!activeChat ? (
          <>
            <div className="chat-panel-header">
              <h2><FaComments /> Месенджер</h2>
              <div className="chat-search-wrapper">
                <FaSearch className="chat-search-icon" />
                <input 
                  type="text" 
                  className="chat-search-input" 
                  placeholder="Пошук..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="chat-tabs">
              <button 
                className={clsx('chat-tab-btn', activeTab === 'personal' && 'active')}
                onClick={() => setActiveTab('personal')}
              >
                <FaInbox size={18} />
                <span>Особисті</span>
              </button>
              <button 
                className={clsx('chat-tab-btn', activeTab === 'events' && 'active')}
                onClick={() => setActiveTab('events')}
              >
                <FaCalendarAlt size={18} />
                <span>Івенти</span>
              </button>
              <button 
                className={clsx('chat-tab-btn', activeTab === 'people' && 'active')}
                onClick={() => setActiveTab('people')}
              >
                <FaUsers size={18} />
                <span>Люди</span>
              </button>
              <button 
                className={clsx('chat-tab-btn', activeTab === 'requests' && 'active')}
                onClick={() => setActiveTab('requests')}
              >
                <div className="tab-icon-wrapper">
                  <FaUserFriends size={18} />
                  {friendRequests.length > 0 && <div className="tab-badge">{friendRequests.length}</div>}
                </div>
                <span>Запити</span>
              </button>
            </div>

            <div className="chat-list-area">
              {loading && <p className="notice">Завантаження...</p>}
              
              {activeTab === 'people' && (
                <div className="people-filter-bar">
                  <select 
                    value={peopleFilter} 
                    onChange={(e) => setPeopleFilter(e.target.value)}
                    className="people-filter-select"
                  >
                    <option value="all">Усі люди</option>
                    <option value="friends">Друзі</option>
                    <option value="banned">Заблоковані</option>
                  </select>
                </div>
              )}

              {!loading && filteredData.length === 0 && (
                <div className="empty-chat-state">
                  <FaInbox size={40} />
                  <p>{activeTab === 'requests' ? 'Немає нових запитів' : 'Нічого не знайдено'}</p>
                </div>
              )}

              {activeTab === 'personal' && filteredData.map(chat => (
                <div key={chat.friend_id} className="chat-item" onClick={() => setActiveChat({ type: 'direct', id: chat.friend_id, name: chat.friend_name })}>
                  <div className="chat-item-avatar">
                    {chat.friend_photo ? (
                      <img src={chat.friend_photo} alt={chat.friend_name} />
                    ) : (
                      chat.friend_name.charAt(0).toUpperCase()
                    )}
                    {chat.is_online && <div className="chat-item-status" />}
                  </div>
                  <div className="chat-item-info">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{chat.friend_name}</span>
                      <span className="chat-item-time">
                        {new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="chat-item-last-msg">
                      {chat.last_sender_id === currentUser.id ? 'Ви: ' : ''}{chat.last_message}
                    </div>
                  </div>
                </div>
              ))}

              {activeTab === 'events' && filteredData.map(event => (
                <div key={event.id} className="chat-item" onClick={() => setActiveChat({ type: 'event', id: event.id, name: event.title })}>
                  <div className="chat-item-avatar" style={{ background: event.photo_url ? 'transparent' : '#f59e0b' }}>
                    {event.photo_url ? (
                      <img src={event.photo_url} alt={event.title} />
                    ) : (
                      <FaCalendarAlt size={20} />
                    )}
                  </div>
                  <div className="chat-item-info">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{event.title}</span>
                    </div>
                    <div className="chat-item-last-msg">{event.location}</div>
                  </div>
                </div>
              ))}

              {activeTab === 'people' && filteredData.map(person => (
                <div key={person.id} className="chat-item person-item">
                  <div className="chat-item-avatar" style={{ background: person.photo_url ? 'transparent' : '#10b981' }}>
                    {person.photo_url ? (
                      <img src={person.photo_url} alt={person.full_name} />
                    ) : (
                      person.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="chat-item-info">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{person.full_name}</span>
                    </div>
                    <div className="chat-item-last-msg">@{person.nickname}</div>
                  </div>
                  <div className="person-actions">
                    {person.friendship_status === 'blocked' ? (
                      <button className="action-btn unban-btn" onClick={() => handleFriendAction('unblock', person.id)} title="Розблокувати">
                        <FaBan />
                      </button>
                    ) : (
                      <>
                        {person.friendship_status === 'accepted' ? (
                          <button className="action-btn remove-btn" onClick={() => handleFriendAction('remove', person.id, person.full_name)} title="Видалити з друзів">
                            <FaUserMinus />
                          </button>
                        ) : (
                          person.friendship_status === 'pending' ? (
                            person.requester_id === currentUser.id ? (
                              <button className="action-btn cancel-btn" onClick={() => handleFriendAction('remove', person.id)} title="Скасувати запит">
                                <FaTimes />
                              </button>
                            ) : null // Should be handled in requests tab, but let's keep it simple
                          ) : (
                            <button className="action-btn add-btn" onClick={() => handleFriendAction('request', person.id)} title="Додати в друзі">
                              <FaUserPlus />
                            </button>
                          )
                        )}
                        <button className="action-btn msg-btn" onClick={() => setActiveChat({ type: 'direct', id: person.id, name: person.full_name })} title="Повідомлення">
                          <FiMessageSquare />
                        </button>
                        <button className="action-btn block-btn" onClick={() => handleFriendAction('block', person.id, person.full_name)} title="Заблокувати">
                          <FaBan />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {activeTab === 'requests' && filteredData.map(request => (
                <div key={request.id} className="chat-item request-item">
                  <div className="chat-item-avatar">
                    {request.photo_url ? (
                      <img src={request.photo_url} alt={request.full_name} />
                    ) : (
                      request.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="chat-item-info">
                    <div className="chat-item-header">
                      <span className="chat-item-name">{request.full_name}</span>
                    </div>
                    <div className="chat-item-last-msg">Запит у друзі</div>
                  </div>
                  <div className="request-actions">
                    <button className="action-btn accept-btn" onClick={() => handleFriendAction('accept', request.id)} title="Прийняти">
                      <FaCheck />
                    </button>
                    <button className="action-btn decline-btn" onClick={() => handleFriendAction('remove', request.id)} title="Відхилити">
                      <FaTimes />
                    </button>
                    <button className="action-btn block-btn" onClick={() => handleFriendAction('block', request.id, request.full_name)} title="Заблокувати">
                      <FaBan />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="active-chat-view">
            <div className="active-chat-header">
              <button className="back-btn" onClick={() => setActiveChat(null)}>
                <FaChevronLeft size={18} />
              </button>
              <div className="chat-item-avatar" style={{ width: 36, height: 36, fontSize: '0.9rem', background: activeChat.type === 'event' ? (activeChat.photo_url ? 'transparent' : '#f59e0b') : (activeChat.photo_url ? 'transparent' : '#6366f1') }}>
                {activeChat.type === 'event' ? (
                  activeChat.photo_url ? <img src={activeChat.photo_url} alt={activeChat.name} /> : <FaCalendarAlt size={16} />
                ) : (
                  activeChat.photo_url ? <img src={activeChat.photo_url} alt={activeChat.name} /> : activeChat.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="chat-item-name">{activeChat.name}</div>
            </div>

            <div className="active-chat-messages">
              {messages.length === 0 && (
                <div className="empty-chat-state">
                  <FaComments size={30} />
                  <p>Повідомлень поки немає.<br/>Почніть спілкування першим!</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.sender_id === currentUser.id;
                return (
                  <div key={msg.id || i} className={clsx('chat-message-wrapper', isMine ? 'chat-message-mine' : 'chat-message-theirs')}>
                    {!isMine && (
                      <div className="chat-message-sender-avatar">
                        {msg.sender_photo ? (
                          <img src={msg.sender_photo} alt={msg.sender_name} />
                        ) : (
                          <div className="avatar-placeholder">{msg.sender_name.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                    )}
                    <div className="chat-message-content">
                      {!isMine && <div className="chat-message-sender">{msg.sender_name}</div>}
                      <div className={clsx('chat-message-bubble', isMine ? 'mine' : 'theirs')}>
                        {msg.text}
                      </div>
                      <div className={clsx('chat-message-time', isMine && 'mine')}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form className="active-chat-input" onSubmit={handleSendMessage}>
              <input 
                type="text" 
                className="chat-input-box" 
                placeholder="Повідомлення..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button type="submit" className="chat-send-icon-btn" disabled={!newMessage.trim()}>
                <FaPaperPlane size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {confirmModal.show && (
        <div className="delete-confirm-modal" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>
          <div className="delete-confirm-content" onClick={e => e.stopPropagation()}>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="delete-confirm-actions">
              <button type="button" className="button button-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}>Скасувати</button>
              <button type="button" className={clsx('button', confirmModal.type === 'danger' ? 'button-danger' : 'button-warning')} onClick={handleConfirm}>
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
