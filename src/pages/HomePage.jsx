import { useMemo, useState, useEffect } from 'react'
// import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import mockEvents from '../data/mockEvents'

const API_URL = 'http://localhost:3000/api'

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    event_date: '',
    max_participants: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  // const navigate = useNavigate()

  // Трансформація даних з API в формат компонента
  const transformEvents = (dbEvents) => {
    return dbEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.event_date ? new Date(event.event_date).toLocaleDateString('uk-UA') : '',
      location: event.location,
      description: event.description,
      category: 'Захід', // Можна додати категорію в БД пізніше
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
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
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
      
      // Для тесту використовуємо перший користувач як creator
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator_id: 1, // TODO: Замініть на реальний ID користувача
          title: formData.title,
          description: formData.description,
          location: formData.location,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          event_date: new Date(formData.event_date).toISOString(),
          max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Помилка при створенні заходу')
      }

      const newEvent = await response.json()
      
      // Додаємо новий захід до списку
      setEvents((prev) => [...prev, transformEvents([newEvent])[0]])
      
      // Закриваємо панель і очищуємо форму
      setShowCreatePanel(false)
      setFormData({
        title: '',
        description: '',
        location: '',
        latitude: '',
        longitude: '',
        event_date: '',
        max_participants: '',
      })
    } catch (err) {
      console.error('Помилка при створенні заходу:', err)
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
        event.category.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      )
    })
  }, [search, events])

  return (
    <div className={`page-shell ${showCreatePanel ? 'with-panel' : ''}`}>
      <header className="site-header">
        <div className="header-left">
          <a href="/" className="brand-link">
            <span className="brand-logo">KMG</span>
            <span className="brand-name">Offline Event Hub</span>
          </a>
        </div>
        <nav className="header-nav">
          <a href="/">Домівка</a>
          <a href="/about">Про нас</a>
          <a href="/account">Аккаунт</a>
          <a href="/contacts">Контакти</a>
        </nav>
      </header>

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
            <button
              type="button"
              className="button"
              onClick={() => setShowCreatePanel(true)}
            >
              Створити подію
            </button>
          </div>

        {loading && <p className="notice">⏳ Завантаження подій...</p>}

        {error && (
          <p className="notice">
            ⚠️ Помилка підключення до сервера ({error}). Показуються кешовані дані.
          </p>
        )}

        <div className="card-list">
          {filteredEvents.map((event) => (
            <article key={event.id} className="event-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <h3>{event.title}</h3>
                <span>{event.date}</span>
              </div>
              <p>{event.description}</p>
              <p className="notice">
                <strong>Локація:</strong> {event.location} · <strong>Учасників:</strong>{' '}
                {event.participants}
              </p>
              <div className="tag-list">
                <span className="tag">{event.category}</span>
              </div>
            </article>
          ))}
          {filteredEvents.length === 0 && !loading && (
            <p className="notice">За вашим запитом подій не знайдено. Спробуйте інші ключові слова.</p>
          )}
        </div>
        <div className="tasks-panel">
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
        </div>
      </div>

      {/* Бічна панель для створення заходу */}
      {showCreatePanel && (
        <aside className="create-event-panel">
          <div className="panel-header">
            <h2>Створити новий захід</h2>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowCreatePanel(false)}
              aria-label="Закрити панель"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="create-event-form">
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

              <div className="form-group">
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
              </div>

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

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCreatePanel(false)}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Створення...' : 'Створити захід'}
                </button>
              </div>
            </form>
          </aside>
      )}
    </main>

      <footer className="site-footer">
        <div className="footer-left">
          <a href="/">Домівка</a>
          <a href="/about">Про нас</a>
          <a href="/account">Аккаунт</a>
          <a href="/contacts">Контакти</a>
        </div>
        <div className="footer-center">
          <p>Плануй заходи швидко, організовуй ефективно, живи яскраво.</p>
        </div>
        <div className="footer-right">
          <p>@KMG</p>
          <p>+38 (050) 961-1945</p>
          <p>support@kmgevent.com</p>
        </div>
      </footer>
    </div>
  )
}
