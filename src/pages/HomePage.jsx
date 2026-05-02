import { useMemo, useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import TopBar from '../components/TopBar'
import mockEvents from '../data/mockEvents'

const API_URL = 'http://localhost:3000/api'

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
    const token = localStorage.getItem('authToken')
    if (token) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setCurrentUser(data.user)
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken')
        })
        .finally(() => setUserLoading(false))
    } else {
      setUserLoading(false)
    }
  }, [])

  const isModerator = currentUser?.role === 'MODERATOR';
  console.info(currentUser);
  const isOwner = selectedEvent?.creator_id === currentUser?.id;
  const isEditMode = !!selectedEvent;
  const hasEventAccess = isOwner || isModerator;

  // Трансформація даних з API в формат компонента
  const transformEvents = (dbEvents) => {
    return dbEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.event_date ? new Date(event.event_date).toLocaleDateString('uk-UA') : '',
      location: event.location,
      description: event.description,
      // category: 'Захід', // Можна додати категорію в БД пізніше
      participants: event.participant_count || 0,
    }))
  }

  // Завантаження даних з БД
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`${API_URL}/events`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
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

  // Обробка змін у формі
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  // Відкриття бічної панелі для редагування/перегляду івенту
  const handleEventClick = async (eventId) => {
    try {
      const response = await fetch(`${API_URL}/events/${eventId}`)
      if (!response.ok) throw new Error('Failed to fetch event')
      const eventData = await response.json()
      
      setSelectedEvent(eventData)
      
      // Заповнюємо форму даними івенту
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

  // Видалення івенту
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    
    try {
      setSubmitting(true)
      const response = await fetch(`${API_URL}/events/${selectedEvent.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Помилка при видаленні заходу')
      }

      // Оновлюємо список подій
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

  // Відправка форми на сервер
  const handleCreateEvent = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Валідація
    if (!formData.title || !formData.location || !formData.event_date) {
      setFormError('Заповніть обов\'язкові поля: назва, локація, дата')
      return
    }

    try {
      setSubmitting(true)
      
      const method = isEditMode ? 'PUT' : 'POST'
      const url = isEditMode ? `${API_URL}/events/${selectedEvent.id}` : `${API_URL}/events`
      
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

      // Для POST додаємо creator_id
      if (!isEditMode) {
        payload.creator_id = currentUser.id
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Помилка при ${isEditMode ? 'редагуванні' : 'створенні'} заходу`)
      }

      const responseData = await response.json()
      const newEvent = responseData.event || responseData

      if (isEditMode) {
        // Оновлюємо список подій
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
      setFormError(err.message)
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
        // event.category.toLowerCase().includes(query) ||
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
            <article
              key={event.id}
              className="event-card"
              onClick={() => handleEventClick(event.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <h3>{event.title}</h3>
                <span>{event.date}</span>
              </div>
              <p>{event.description}</p>
              <p className="notice">
                <strong>Локація:</strong> {event.location} · <strong>Учасників:</strong>{' '}
                {event.participants}
              </p>
            </article>
          ))}
          {filteredEvents.length === 0 && !loading && (
            <p className="notice">За вашим запитом подій не знайдено. Спробуйте інші ключові слова.</p>
          )}
        </div>
        {/* <div className="tasks-panel">
          <div className="task-card">
            <h4>Швидкі задачі організатора</h4>
            <ul className="task-list">
              <li>Перевірити список реєстрацій</li>
              <li>Створити нову офлайн-подію</li>
              <li>Відредагувати обрані заходи</li>
              <li>Отримати контакти учасників</li>
            </ul>
          </div>
          <div className="task-card">
            <h4>Поточні процеси</h4>
            <p className="notice">Автоматизація дозволяє зменшити час на координацію та обробку заявок.</p>
          </div>
        </div> */}
      </div>

      {/* Бічна панель для створення заходу */}
      {showCreatePanel && (
        <>
          <aside className="create-event-panel">
          <div className="panel-header">
            <h2>{selectedEvent ? 'Деталі заходу' : 'Створити новий захід'}</h2>
            <button
              type="button"
              className="close-btn"
              onClick={() => {
                setShowCreatePanel(false)
                setSelectedEvent(null)
              }}
              aria-label="Закрити панель"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="create-event-form">
              {isEditMode && !hasEventAccess && (
                <div className="notice" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
                  📖 Ви можете лише переглядати цей захід
                </div>
              )}

              {formError && (
                <div className="form-error">
                  <p>❌ {formError}</p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="title">Назва заходу *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="Турнір Catan, Вечір ігор, тощо"
                  required
                />
              </div>

              {/* <div className="form-group">
                <label htmlFor="description">Опис</label>
                <input
                  className="big"
                  type="text"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Розповідайте про захід, хто може взяти участь, що очікувати"
                  // rows="4"
                />
              </div> */}

              <div className="form-group">
                <label htmlFor="location">Місце проведення *</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleFormChange}
                  placeholder="Адреса або назва закладу"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="latitude">Широта</label>
                  <input
                    type="number"
                    id="latitude"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleFormChange}
                    placeholder="50.4501"
                    step="0.0001"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Довгота</label>
                  <input
                    type="number"
                    id="longitude"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleFormChange}
                    placeholder="30.5234"
                    step="0.0001"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="event_date">Дата та час *</label>
                <input
                  type="datetime-local"
                  id="event_date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="max_participants">Максимальна кількість учасників</label>
                <input
                  type="number"
                  id="max_participants"
                  name="max_participants"
                  value={formData.max_participants}
                  onChange={handleFormChange}
                  placeholder="16"
                  min="1"
                />
              </div>

              {(!isEditMode || hasEventAccess) && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
                  <label htmlFor="is_private" style={{ margin: 0 }}>Приватний захід</label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      id="is_private"
                      name="is_private"
                      checked={formData.is_private}
                      onChange={handleFormChange}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setShowCreatePanel(false)
                    setSelectedEvent(null)
                  }}
                >
                  {selectedEvent ? 'Закрити' : 'Скасувати'}
                </button>
                {isEditMode && (selectedEvent?.creator_id === currentUser?.id || isModerator) && (
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Видалити захід"
                  >
                    🗑️
                  </button>
                )}
                {(!isEditMode || hasEventAccess) && (
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={submitting}
                  >
                    {submitting
                      ? (selectedEvent ? 'Збереження...' : 'Створення...')
                      : (selectedEvent ? 'Зберегти' : 'Створити захід')}
                  </button>
                )}
              </div>
            </form>
          </aside>
          {showDeleteConfirm && (
            <div className="delete-confirm-modal">
              <div className="delete-confirm-content">
                <h3>Видалити захід?</h3>
                <p>Ви впевнені, що хочете видалити захід <strong>{selectedEvent?.title}</strong>?</p>
                <p className="delete-confirm-warning">Ця дія не може бути скасована.</p>
                <div className="delete-confirm-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={submitting}
                  >
                    Скасувати
                  </button>
                  <button
                    type="button"
                    className="button button-danger"
                    onClick={handleDeleteEvent}
                    disabled={submitting}
                  >
                    {submitting ? 'Видалення...' : 'Видалити'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
      <Footer />
    </div>
  )
}
