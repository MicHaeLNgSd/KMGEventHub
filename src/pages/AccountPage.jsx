import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import avatarPlaceholder from '../assets/avatar-placeholder.svg'
import API from '../utils/api'
import { authService } from '../services/authService'
import { validateAge, validatePhone } from '../utils/validators'
import { formatPhoneInput } from '../utils/formatters'

export default function AccountPage() {
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    nickname: '',
    email: '',
    age: '',
    phone_number: '',
    bio: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchUser = async () => {
      try {
        setLoading(true)
        // Спочатку отримати базові дані користувача
        const meResponse = await authService.getCurrentUser()
        const currentUser = meResponse.user

        // Потім отримати повні дані
        const response = await API.get(`/users/${currentUser.id}`)
        const data = response.data
        setUser(data)
        setForm({
          full_name: data.full_name || '',
          nickname: data.nickname || '',
          email: data.email || '',
          age: data.age || '',
          phone_number: data.phone_number || '+38',
          bio: data.bio || ''
        })
      } catch (fetchError) {
        console.error('Account fetch error:', fetchError)
        setError('Не вдалося завантажити дані профілю.')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleChangePhone = (event) => {
    const { name, value } = event.target
    const formattedPhone = formatPhoneInput(value)
    setForm((prev) => ({ ...prev, [name]: formattedPhone }))
  }

  
  const handleSave = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const trimmedPhone = form.phone_number.trim()
    const trimmedAge = (form.age+'').trim()

    const phoneError = validatePhone(trimmedPhone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    const ageError = validateAge(trimmedAge)
    if (ageError) {
      setError(ageError)
      return
    }

    if (!form.full_name.trim() || !form.nickname.trim() || !form.email.trim()) {
      setError('Ім’я, прізвисько та email є обов’язковими.')
      return
    }

    try {
      setSaving(true)
      const response = await API.put(`/users/${user.id}`, {
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim(),
        email: form.email.trim().toLowerCase(),
        age: trimmedAge || null,
        phone_number: trimmedPhone || null,
        bio: form.bio.trim() || null
      })

      setUser(response.data.user)
      setMessage('Профіль успішно збережено.')
      // User data is now fetched via API on each load
    } catch (saveError) {
      console.error('Account save error:', saveError)
      setError(saveError.response?.data?.error || 'Помилка збереження профілю. Спробуйте пізніше.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="app-shell auth-shell">
        <div className="page-card auth-card">
          <p className="notice">Завантаження профілю...</p>
        </div>
      </main>
    )
  }

  return (
    <div className="page-shell">
      <Header />

      <main className="app-shell">
        <div className="page-card profile-card">
          <div className="profile-header">
            <div className="profile-avatar-block">
              <img src={avatarPlaceholder} alt="Аватар" className="profile-avatar" />
            </div>
            <div className="profile-details">
              <p className="notice">Ваш обліковий запис</p>
              <h2>{user?.full_name || 'Користувач'}</h2>
              <p>@{user?.nickname || 'nickname'}</p>
              <p>{user?.email}</p>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            <div className="profile-grid">
              <div className="profile-field">
                <label htmlFor="full_name">Ім'я</label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="profile-field">
                <label htmlFor="nickname">Прізвисько</label>
                <input
                  id="nickname"
                  name="nickname"
                  type="text"
                  value={form.nickname}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="profile-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="profile-field">
                <label htmlFor="age">Вік</label>
                <input
                  id="age"
                  name="age"
                  type="number"
                  min="13"
                  max="120"
                  value={form.age}
                  onChange={handleChange}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="phone_number">Телефон</label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={form.phone_number}
                  onChange={handleChangePhone}
                  placeholder="+380501234567"
                />
              </div>
              <div className="profile-field profile-field-full">
                <label htmlFor="bio">Про себе</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="Розповідайте про себе..."
                  rows="4"
                />
              </div>
              <div className="profile-field">
                <label>Створено</label>
                <div className="profile-readonly">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA') : '—'}
                </div>
              </div>
              <div className="profile-field">
                <label>Статус</label>
                <div className="profile-readonly">
                  {user?.is_active ? '✓ Активний' : '✗ Неактивний'}
                </div>
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}
            {message && <p className="notice">{message}</p>}

            <div className="profile-actions">
              <button type="submit" className="button button-primary button-half" disabled={saving}>
                {saving ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}
