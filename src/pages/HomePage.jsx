import { useMemo, useState, useEffect } from 'react'
import clsx from 'clsx'
import { FaUserFriends, FaCalendarAlt, FaHourglassHalf, FaExclamationTriangle } from 'react-icons/fa'
import Header from '../components/Header'
import Footer from '../components/Footer'
import TopBar from '../components/TopBar'
import EventCard from '../components/EventCard'
import EventFormPanel from '../components/EventFormPanel'
import { eventService } from '../services/eventService'
import { authService } from '../services/authService'
import { EVENT_CATEGORIES } from '../utils/categories'

export default function HomePage({ currentUser, setUser }) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMyEvents, setFilterMyEvents] = useState(false)
  const [filterJoined, setFilterJoined] = useState(false)
  const [filterMinParticipants, setFilterMinParticipants] = useState('')
  const [filterMaxParticipants, setFilterMaxParticipants] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [userLoading, setUserLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalEvents, setTotalEvents] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    latitude: null,
    longitude: null,
    event_date: '',
    max_participants: '',
    is_private: false,
    category: '',
    photo_url: null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)


  const isModerator = currentUser?.role === 'MODERATOR';
  const isOwner = selectedEvent?.creator_id === currentUser?.id;
  const isEditMode = !!selectedEvent;
  const hasEventAccess = isOwner || isModerator;

  const transformEvents = (dbEvents) => {
    return dbEvents.map((event) => ({
      id: event.id,
      title: event.title,
      event_date: event.event_date,
      location: event.location,
      description: event.description,
      participant_count: event.participant_count || 0,
      max_participants: event.max_participants,
      category: event.category,
      photo_url: event.photo_url,
      creator_id: event.creator_id,
      creator_name: event.creator_name,
      creator_nickname: event.creator_nickname,
      participant_ids: Array.isArray(event.participant_ids) ? event.participant_ids : [],
    }))
  }

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const filters = {
        category: filterCategory,
        minParticipants: filterMinParticipants,
        maxParticipants: filterMaxParticipants,
        startDate: filterDate,
        search: search,
        userId: currentUser?.id,
        myEvents: filterMyEvents,
        joinedEvents: filterJoined,
        page: currentPage,
        limit: 10
      }
      const data = await eventService.getEvents(filters)
      setEvents(transformEvents(data.events || []))
      setTotalPages(data.totalPages || 1)
      setTotalEvents(data.totalCount || 0)
      setError(null)
    } catch (err) {
      console.error('Error loading events:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [
    filterCategory, 
    filterMinParticipants, 
    filterMaxParticipants, 
    filterDate, 
    filterMyEvents, 
    filterJoined,
    search
  ])

  useEffect(() => {
    fetchEvents()
  }, [
    filterCategory, 
    filterMinParticipants, 
    filterMaxParticipants, 
    filterDate, 
    filterMyEvents, 
    filterJoined,
    currentUser?.id,
    currentPage
  ])

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleEventClick = async (eventId) => {
    try {
      const eventData = await eventService.getEventById(eventId)
      setSelectedEvent(eventData)
      
      setFormData({
        title: eventData.title || '',
        description: eventData.description || '',
        location: eventData.location || '',
        latitude: eventData.latitude !== null ? Number(eventData.latitude) : null,
        longitude: eventData.longitude !== null ? Number(eventData.longitude) : null,
        event_date: eventData.event_date ? new Date(eventData.event_date).toISOString().slice(0, 16) : '',
        max_participants: eventData.max_participants || '',
        is_private: eventData.is_private || false,
        category: eventData.category || '',
        photo_url: eventData.photo_url || null,
      })
      
      setShowCreatePanel(true)
    } catch (err) {
      console.error('Error loading event:', err)
      setFormError('Помилка при завантаженні інформації про захід')
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    
    try {
      setSubmitting(true)
      await eventService.deleteEvent(selectedEvent.id)
      
      fetchEvents()
      
      setShowCreatePanel(false)
      setSelectedEvent(null)
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Error deleting event:', err)
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinEvent = async (eventId) => {
    try {
      setSubmitting(true);
      setFormError(null);
      await eventService.joinEvent(eventId);
      
      const updatedEvent = await eventService.getEventById(eventId);
      setSelectedEvent(updatedEvent);
      
      fetchEvents();
    } catch (err) {
      console.error('Error joining event:', err);
      setFormError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleLeaveEvent = async (eventId) => {
    try {
      setSubmitting(true);
      setFormError(null);
      await eventService.leaveEvent(eventId);
      
      const updatedEvent = await eventService.getEventById(eventId);
      setSelectedEvent(updatedEvent);
      
      fetchEvents();
    } catch (err) {
      console.error('Error leaving event:', err);
      setFormError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleCreateEvent = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.title || !formData.location || !formData.event_date) {
      setFormError('Заповніть обов\'язкові поля: назва, локація, дата')
      return
    }

    try {
      setSubmitting(true)
      
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        event_date: new Date(formData.event_date).toISOString(),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        is_private: formData.is_private,
        category: formData.category,
        photo_url: formData.photo_url,
      }

      if (!isEditMode) {
        payload.creator_id = currentUser.id
      }

      const responseData = isEditMode
        ? await eventService.updateEvent(selectedEvent.id, payload)
        : await eventService.createEvent(payload)

      fetchEvents()
      
      setShowCreatePanel(false)
      setSelectedEvent(null)
      setFormData({
        title: '',
        description: '',
        location: '',
        latitude: '',
        longitude: '',
        event_date: '',
        max_participants: '',
        is_private: false,
        category: '',
        photo_url: null,
      })
    } catch (err) {
      console.error(`Error ${selectedEvent ? 'updating' : 'creating'} event:`, err)
      setFormError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (userLoading) {
    return (
      <div className="page-shell">
        <Header currentUser={currentUser} />
        <main className="app-shell">
          <div className="page-card">Завантаження...</div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className={clsx('page-shell', showCreatePanel && 'with-panel')}>
      <Header currentUser={currentUser} />

      <main className={clsx('app-shell', showCreatePanel && 'with-panel')}>
        <div className="page-card">
          <TopBar />
          <div className="search-bar">
            <input
              type="search"
              placeholder="Пошук заходів за назвою, локацією або категорією"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {!isModerator && (
              <button
                type="button"
                className="button"
                onClick={() => {
                  setSelectedEvent(null)
                  setFormData({
                    title: '',
                    description: '',
                    location: '',
                    latitude: '',
                    longitude: '',
                    event_date: '',
                    max_participants: '',
                    is_private: false,
                    category: '',
                    photo_url: null,
                  })
                  setShowCreatePanel(true)
                }}
              >
                Створити подію
              </button>
            )}
          </div>

          <div className="filters-bar premium-filters">
            <select 
              value={filterCategory} 
              onChange={e => setFilterCategory(e.target.value)} 
              className="premium-filter-input"
            >
              <option value="">Всі категорії</option>
              {EVENT_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            
            <div className="filter-input-wrapper">
              <FaUserFriends className="filter-icon" />
              <input 
                type="number" 
                placeholder="Мін. учасників" 
                value={filterMinParticipants} 
                onChange={e => setFilterMinParticipants(e.target.value)}
                min="0"
                className="premium-filter-input number-input-no-arrows"
              />
            </div>
            
            <div className="filter-input-wrapper">
              <FaUserFriends className="filter-icon" />
              <input 
                type="number" 
                placeholder="Макс. учасників" 
                value={filterMaxParticipants} 
                onChange={e => setFilterMaxParticipants(e.target.value)}
                min="1"
                className="premium-filter-input number-input-no-arrows"
              />
            </div>
            
            <div className="filter-input-wrapper">
              <FaCalendarAlt className="filter-icon" />
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                className="premium-filter-input"
              />
            </div>
            
            <div className="premium-checkbox-group">
              <label className="premium-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={filterMyEvents} 
                  onChange={e => setFilterMyEvents(e.target.checked)} 
                  className="premium-checkbox" 
                />
                <span className="premium-checkbox-text">Мої</span>
              </label>
              <label className="premium-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={filterJoined} 
                  onChange={e => setFilterJoined(e.target.checked)} 
                  className="premium-checkbox" 
                />
                <span className="premium-checkbox-text">Участвую</span>
              </label>
            </div>
          </div>

        {loading && <p className="notice"><FaHourglassHalf className="icon-mr" /> Завантаження подій...</p>}

        {error && (
          <p className="notice">
            <FaExclamationTriangle className="icon-mr" /> Помилка підключення до сервера ({error}). Показуються кешовані дані.
          </p>
        )}

        <div className="card-list">
          {events.map((event) => (
            <EventCard key={event.id} event={event} onClick={handleEventClick} />
          ))}
          {events.length === 0 && !loading && (
            <p className="notice">За вашим запитом подій не знайдено. Спробуйте інші ключові слова.</p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn" 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              ← Назад
            </button>
            <div className="pagination-pages">
              {[...Array(totalPages)].map((_, i) => (
                <button 
                  key={i + 1}
                  className={clsx('pagination-page-btn', currentPage === i + 1 && 'active')}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              className="pagination-btn" 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Вперед →
            </button>
          </div>
        )}
      </div>

      {showCreatePanel && (
        <EventFormPanel
          selectedEvent={selectedEvent}
          currentUser={currentUser}
          isModerator={isModerator}
          formData={formData}
          formError={formError}
          submitting={submitting}
          isEditMode={isEditMode}
          hasEventAccess={hasEventAccess}
          handleFormChange={handleFormChange}
          handleCreateEvent={handleCreateEvent}
          handleDeleteEvent={handleDeleteEvent}
          handleJoinEvent={handleJoinEvent}
          handleLeaveEvent={handleLeaveEvent}
          onClose={() => {
            setShowCreatePanel(false)
            setSelectedEvent(null)
          }}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
        />
      )}
    </main>
      <Footer />
    </div>
  )
}
