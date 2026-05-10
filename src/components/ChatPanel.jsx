import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { 
  FaComments, FaUsers, FaCalendarAlt, FaSearch, 
  FaChevronRight, FaChevronLeft, FaPaperPlane,
  FaUserCircle, FaInbox, FaUserPlus, FaUserMinus, 
  FaBan, FaCheck, FaTimes, FaEllipsisV, FaUserFriends, FaUserShield
} from 'react-icons/fa';
import { FiMessageSquare } from 'react-icons/fi';
import { formatRelative, formatDistanceToNow } from 'date-fns';
import { uk } from 'date-fns/locale';
import { chatService } from '../services/chatService';
import { eventService } from '../services/eventService';
import { socketService } from '../services/socketService';
import API from '../utils/api';
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
  const [chatParticipants, setChatParticipants] = useState([]);
  const [showChatParticipants, setShowChatParticipants] = useState(false);
  
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
  const isModerator = currentUser?.role === 'MODERATOR';

  // Stable data loader
  const loadTabData = useCallback(async (isSilent = false) => {
    if (!currentUser) return;
    if (!isSilent) setLoading(true);
    try {
      // 1. Always fetch requests to keep the badge updated
      const requestsData = await chatService.getFriendRequests();
      setFriendRequests(requestsData);

      // 2. Tab-specific data
      if (activeTab === 'personal') {
        const data = await chatService.getPersonalChats();
        setPersonalChats(data);
      } else if (activeTab === 'events') {
        let uniqueEvents = [];
        if (isModerator) {
          const response = await eventService.getEvents({ limit: 100 });
          uniqueEvents = response.events;
        } else {
          const response = await eventService.getEvents({ userId: currentUser.id, joinedEvents: true, limit: 100 });
          const myResponse = await eventService.getEvents({ userId: currentUser.id, myEvents: true, limit: 100 });
          const allEvents = [...response.events, ...myResponse.events];
          uniqueEvents = Array.from(new Map(allEvents.map(item => [item.id, item])).values());
        }
        setEvents(uniqueEvents);
      } else if (activeTab === 'people') {
        const data = await chatService.getAllUsers();
        setPeople(data);
      }
    } catch (err) {
      console.error('Error loading chat data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [activeTab, currentUser?.id]);

  // Socket setup - Always active for friendship & notifications
  useEffect(() => {
    if (!currentUser) return;
    
    // Ensure socket is connected and in room
    socketService.connect();
    socketService.joinPersonalRoom(currentUser.id);

    const refresh = () => {
      loadTabData(true);
    };

    // Register friendship events
    socketService.onFriendRequestReceived(refresh);
    socketService.onFriendRequestAccepted(refresh);
    socketService.onFriendRemoved(refresh);
    socketService.onUserBlocked(refresh);
    socketService.onUserUnblocked(refresh);
    socketService.onChatListUpdate(refresh);
    socketService.onKickedFromEvent(refresh);
    
    const handleEventDeleted = (data) => {
      if (activeChat?.type === 'event' && activeChat?.id === data.eventId) {
        setActiveChat(null);
      }
      refresh();
    };
    socketService.onEventDeleted(handleEventDeleted);

    // Initial load for requests (for badge) even if closed
    chatService.getFriendRequests().then(setFriendRequests).catch(err => console.error(err));

    return () => {
      socketService.offFriendRequestReceived(refresh);
      socketService.offFriendRequestAccepted(refresh);
      socketService.offFriendRemoved(refresh);
      socketService.offUserBlocked(refresh);
      socketService.offUserUnblocked(refresh);
      socketService.offChatListUpdate(refresh);
      socketService.offKickedFromEvent(refresh);
      socketService.offEventDeleted(handleEventDeleted);
    };
  }, [currentUser?.id, loadTabData]); // Removed activeChat to avoid re-subscribing on every chat change

  // Load tab data when panel is opened
  useEffect(() => {
    if (isOpen && currentUser) {
      loadTabData();
    }
  }, [isOpen, activeTab, loadTabData]);

  const loadMessages = useCallback(async () => {
    if (!activeChat) return;
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
  }, [activeChat]);

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

  // Chat History Loading
  useEffect(() => {
    if (activeChat) {
      const handleNewMessage = (msg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      };

      const handleMessageDeleted = (data) => {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      };

      const handleParticipantJoined = (data) => {
        if (data.user) {
          setChatParticipants(prev => {
            if (prev.some(p => p.id === data.user.id)) return prev;
            return [...prev, data.user];
          });
        }
      };

      const handleParticipantLeft = (data) => {
        setChatParticipants(prev => prev.filter(p => p.id !== data.userId));
      };

      loadMessages();
      setShowChatParticipants(false);
      
      socketService.onMessageDeleted(handleMessageDeleted);

      if (activeChat.type === 'direct') {
        socketService.joinDirectChat(activeChat.id);
        socketService.onNewDirectMessage(handleNewMessage);
      } else {
        socketService.joinEvent(activeChat.id);
        socketService.onNewMessage(handleNewMessage);
        
        eventService.getEventById(activeChat.id).then(data => {
          setChatParticipants(data.participants || []);
        });
        
        socketService.onParticipantJoined(handleParticipantJoined);
        socketService.onParticipantLeft(handleParticipantLeft);
      }

      return () => {
        if (activeChat.type === 'direct') {
          socketService.leaveDirectChat(activeChat.id);
          socketService.offNewDirectMessage(handleNewMessage);
        } else {
          socketService.leaveEvent(activeChat.id);
          socketService.offNewMessage(handleNewMessage);
          socketService.offParticipantJoined(handleParticipantJoined);
          socketService.offParticipantLeft(handleParticipantLeft);
        }
        socketService.offMessageDeleted(handleMessageDeleted);
      };
    }
  }, [activeChat, loadMessages]);

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
      } else if (action === 'ban') {
        await chatService.banUser(targetId);
      } else if (action === 'unban') {
        await chatService.unbanUser(targetId);
      } else if (action === 'kick') {
        await chatService.kickParticipant(activeChat.id, targetId);
        // Immediately update participant list
        setChatParticipants(prev => prev.filter(p => p.id !== targetId));
      } else if (action === 'deleteMessage') {
        await API.delete(`/messages/${targetId}`);
        setMessages(prev => prev.filter(m => m.id !== targetId));
      }
      loadTabData();
    } catch (err) {
      console.error(`Error during ${action} confirmation:`, err);
    }
    setConfirmModal(prev => ({ ...prev, show: false }));
  };

  const handleModeratorAction = async (action, id, name) => {
    if (action === 'ban') {
      setConfirmModal({
        show: true,
        title: 'Забанити акаунт?',
        message: `Ви впевнені, що хочете забанити ${name}? Користувач більше не зможе увійти в систему.`,
        confirmText: 'Забанити',
        type: 'danger',
        action: 'ban',
        targetId: id,
        targetName: name
      });
    } else if (action === 'kick') {
      setConfirmModal({
        show: true,
        title: 'Видалити з івенту?',
        message: `Ви впевнені, що хочете видалити ${name} з цього заходу?`,
        confirmText: 'Видалити',
        type: 'danger',
        action: 'kick',
        targetId: id,
        targetName: name
      });
    } else if (action === 'deleteMessage') {
      setConfirmModal({
        show: true,
        title: 'Видалити повідомлення?',
        message: 'Ви впевнені, що хочете видалити це повідомлення? Цю дію неможливо скасувати.',
        confirmText: 'Видалити',
        type: 'danger',
        action: 'deleteMessage',
        targetId: id
      });
    }
  };

  const handleUnban = async (id) => {
    try {
      await chatService.unbanUser(id);
      loadTabData();
    } catch (err) {
      console.error('Error unbanning user:', err);
    }
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
        if (peopleFilter === 'banned') return matchesQuery && (p.is_blocked_by_me || (isModerator && p.is_banned));
        
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
        {friendRequests.length > 0 && <div className="trigger-badge">{friendRequests.length}</div>}
      </div>

      <div className="chat-panel-content">
        {!activeChat ? (
          <>
            <div className="chat-panel-header">
              <h2><FaComments /> Месенджер</h2>
              <button className="chat-close-x-btn" onClick={() => setIsOpen(false)} title="Закрити">
                <FaTimes size={18} />
              </button>
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
                        {formatDistanceToNow(new Date(chat.last_message_time), { addSuffix: true, locale: uk })}
                      </span>
                    </div>
                    <div className="chat-item-last-msg">
                      {chat.last_sender_id === currentUser.id ? 'Ви: ' : ''}{chat.last_message}
                    </div>
                  </div>
                </div>
              ))}

              {activeTab === 'events' && filteredData.map(event => (
                <div key={event.id} className="chat-item" onClick={() => setActiveChat({ type: 'event', id: event.id, name: event.title, creator_id: event.creator_id })}>
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
                      <span className="chat-item-name">
                        {person.is_banned && <span className="banned-badge-mini">BAN</span>}
                        {person.role === 'MODERATOR' && <span className="role-badge-mini">MOD</span>}
                        {person.full_name}
                      </span>
                    </div>
                    <div className="chat-item-last-msg">@{person.nickname}</div>
                  </div>
                  <div className="person-actions">
                    {currentUser.role !== 'MODERATOR' && (
                      person.friendship_status === 'blocked' ? (
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
                              ) : null 
                            ) : (
                              <button className="action-btn add-btn" onClick={() => handleFriendAction('request', person.id)} title="Додати в друзі">
                                <FaUserPlus />
                              </button>
                            )
                          )}
                          <button className="action-btn msg-btn" onClick={() => setActiveChat({ type: 'direct', id: person.id, name: person.full_name })} title="Повідомлення">
                            <FiMessageSquare />
                          </button>
                          {person.role !== 'MODERATOR' && (
                            <button className="action-btn block-btn" onClick={() => handleFriendAction('block', person.id, person.full_name)} title="Заблокувати">
                              <FaBan />
                            </button>
                          )}
                        </>
                      )
                    )}

                    {currentUser.role === 'MODERATOR' && person.id !== currentUser.id && (
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
                              ) : null 
                            ) : (
                              <button className="action-btn add-btn" onClick={() => handleFriendAction('request', person.id)} title="Додати в друзі">
                                <FaUserPlus />
                              </button>
                            )
                          )}
                        <button className="action-btn msg-btn" onClick={() => setActiveChat({ type: 'direct', id: person.id, name: person.full_name })} title="Повідомлення">
                          <FiMessageSquare />
                        </button>
                        {person.role !== 'MODERATOR' &&
                          <button 
                            className={clsx('action-btn', person.is_banned ? 'unban-btn' : 'block-btn')} 
                            onClick={() => person.is_banned ? handleUnban(person.id) : handleModeratorAction('ban', person.id, person.full_name)} 
                            title={person.is_banned ? 'Розбанити' : 'Забанити акаунт'}
                          >
                            <FaUserShield />
                          </button>
                        }
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
              <div className="active-chat-actions">
                {activeChat.type === 'event' && (
                  <button 
                    className="action-btn" 
                    onClick={() => setShowChatParticipants(!showChatParticipants)}
                    title="Учасники"
                  >
                    <FaUsers size={16} />
                  </button>
                )}
                <button className="chat-close-x-btn" onClick={() => setIsOpen(false)} title="Закрити">
                  <FaTimes size={18} />
                </button>
              </div>
            </div>

            {/* Participant dropdown for event chats */}
            {showChatParticipants && activeChat.type === 'event' && (
              <div className="chat-participants-dropdown">
                <div className="chat-participants-title">Учасники ({chatParticipants.length})</div>
                {chatParticipants.map(p => (
                  <div key={p.id} className="chat-participant-item">
                    <div className="chat-item-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem', background: p.photo_url ? 'transparent' : '#10b981' }}>
                      {p.photo_url ? <img src={p.photo_url} alt={p.full_name} /> : p.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="chat-participant-info">
                      <span className="chat-participant-name">{p.full_name}</span>
                      {p.id === activeChat.creator_id && <span className="participant-author-badge">Автор</span>}
                    </div>
                    {p.id !== activeChat.creator_id && p.id !== currentUser.id && (currentUser.id === activeChat.creator_id || currentUser.role === 'MODERATOR') && (
                      <button 
                        className="kick-participant-btn-small" 
                        onClick={() => handleModeratorAction('kick', p.id, p.full_name)}
                        title="Видалити з івенту"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

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
                        <div className="chat-message-header-line">
                          {!isMine && <div className="chat-message-sender">{msg.sender_name}</div>}
                          {(isMine || (activeChat.type === 'event' && (currentUser.id === activeChat.creator_id || currentUser.role === 'MODERATOR'))) && (
                            <button 
                              className="delete-msg-btn" 
                              onClick={() => handleModeratorAction('deleteMessage', msg.id)}
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
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: uk })}
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
