import { useMemo, useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import TopBar from '../components/TopBar'
import EventCard from '../components/EventCard'
import EventFormPanel from '../components/EventFormPanel'
import { eventService } from '../services/eventService'
import { authService } from '../services/authService'
import mockEvents from '../data/mockEvents'

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    event_date: '',
    max_participants: '',
    is_private: false,
    category: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('authToken')
      if (token) {
        try {
          const data = await authService.getCurrentUser()
          if (data.user) {
            setCurrentUser(data.user)
          }
        } catch (err) {
          // Якщо токен недійсний, axios interceptor видалить його та перенаправить на логін
          console.error('Failed to fetch user:', err)
        }
      }
      setUserLoading(false)
    }
    fetchUser()
  }, [])

  const isModerator = currentUser?.role === 'MODERATOR';
  const isOwner = selectedEvent?.creator_id === currentUser?.id;
  const isEditMode = !!selectedEvent;
  const hasEventAccess = isOwner || isModerator;

  const transformEvents = (dbEvents) => {
    return dbEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.event_date ? new Date(event.event_date).toLocaleDateString('uk-UA') : '',
      location: event.location,
      description: event.description,
      participants: event.participant_count || 0,
    }))
  }

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await eventService.getEvents()
        setEvents(transformEvents(data))
      } catch (err) {
        console.error('Помилка при завантаженні подій:', err)
        setError(err.message)
        // Fallback на mock дані
        setEvents(mockEvents)
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

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
        latitude: eventData.latitude || '',
        longitude: eventData.longitude || '',
        event_date: eventData.event_date ? new Date(eventData.event_date).toISOString().slice(0, 16) : '',
        max_participants: eventData.max_participants || '',
        is_private: eventData.is_private || false,
        category: eventData.category || '',
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

      setEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id))
      
      setShowCreatePanel(false)
      setSelectedEvent(null)
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Помилка при видаленні заходу:', err)
      setFormError(err.message)
    } finally {
      setSubmitting(false)
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
      }

      if (!isEditMode) {
        payload.creator_id = currentUser.id
      }

      const responseData = isEditMode
        ? await eventService.updateEvent(selectedEvent.id, payload)
        : await eventService.createEvent(payload)

      const newEvent = responseData.event || responseData

      if (isEditMode) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === selectedEvent.id
              ? {
                  id: newEvent.id,
                  title: newEvent.title,
                  date: new Date(newEvent.event_date).toLocaleDateString('uk-UA'),
                  location: newEvent.location,
                  description: newEvent.description,
                  participants: e.participants,
                }
              : e
          )
        )
      } else {
        setEvents((prev) => [
          ...prev,
          {
            id: newEvent.id,
            title: newEvent.title,
            date: new Date(newEvent.event_date).toLocaleDateString('uk-UA'),
            location: newEvent.location,
            description: newEvent.description,
            participants: 1,
          },
        ])
      }
      
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
      })
    } catch (err) {
      console.error(`Помилка при ${selectedEvent ? 'редагуванні' : 'створенні'} заходу:`, err)
      setFormError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return events
    }
    return events.filter((event) => {
      return (
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      )
    })
  }, [search, events])

  if (userLoading) {
    return (
      <div className="page-shell">
        <Header />
        <main className="app-shell">
          <div className="page-card">Завантаження...</div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className={`page-shell ${showCreatePanel ? 'with-panel' : ''}`}>
      <Header />

      <main className={`app-shell ${showCreatePanel ? 'with-panel' : ''}`}>
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
                  })
                  setShowCreatePanel(true)
                }}
              >
                Створити подію
              </button>
            )}
          </div>

        {loading && <p className="notice">⏳ Завантаження подій...</p>}

        {error && (
          <p className="notice">
            ⚠️ Помилка підключення до сервера ({error}). Показуються кешовані дані.
          </p>
        )}

        <div className="card-list">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} onClick={handleEventClick} />
          ))}
          {filteredEvents.length === 0 && !loading && (
            <p className="notice">За вашим запитом подій не знайдено. Спробуйте інші ключові слова.</p>
          )}
        </div>
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
