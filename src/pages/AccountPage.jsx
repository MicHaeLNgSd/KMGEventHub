import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import Header from '../components/Header'
import Footer from '../components/Footer'
import avatarPlaceholder from '../assets/avatar-placeholder.svg'
import API from '../utils/api'
import { authService } from '../services/authService'
import { validateAge, validatePhone } from '../utils/validators'
import { formatPhoneInput } from '../utils/formatters'
import { FaPencilAlt, FaTrash } from 'react-icons/fa'
import './AccountPage.css'

export default function AccountPage({ currentUser: globalUser, setUser: setGlobalUser }) {
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
        const meResponse = await authService.getCurrentUser()
        const currentUser = meResponse.user

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

    const handleVisibility = () => {
      setUser((prev) => {
        if (!prev) return prev;
        return { ...prev, is_active: document.visibilityState === 'visible' };
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [navigate])

  const handleLogout = async () => {
    try {
      await API.put('/users/status', { is_active: false })
    } catch (error) {
      console.error('Failed to set offline status:', error)
    }
    localStorage.removeItem('authToken')
    setGlobalUser(null)
    navigate('/login')
  }

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
        bio: form.bio.trim() || null,
        photo_url: user.photo_url
      })

      setUser(response.data.user)
      setGlobalUser(response.data.user)
      setMessage('Профіль успішно збережено.')
      // User data is now fetched via API on each load
    } catch (saveError) {
      console.error('Account save error:', saveError)
      setError(saveError.response?.data?.error || 'Помилка збереження профілю. Спробуйте пізніше.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('image', file)

    try {
      setSaving(true)
      const uploadRes = await API.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const imageUrl = uploadRes.data.imageUrl
      const fullUrl = `${API.defaults.baseURL.replace('/api', '')}${imageUrl}`

      const response = await API.put(`/users/${user.id}`, {
        ...form,
        photo_url: fullUrl
      })

      setUser(response.data.user)
      setGlobalUser(response.data.user)
      setMessage('Аватар успішно оновлено.')
    } catch (err) {
      console.error('Avatar upload error:', err)
      setError('Не вдалося завантажити аватар.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveAvatar = async () => {
    try {
      setSaving(true)
      const response = await API.put(`/users/${user.id}`, {
        ...form,
        photo_url: null
      })
      setUser(response.data.user)
      setGlobalUser(response.data.user)
      setMessage('Аватар видалено.')
    } catch (err) {
      console.error('Avatar removal error:', err)
      setError('Не вдалося видалити аватар.')
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
      <Header currentUser={globalUser} />

      <main className="app-shell">
        <div className="page-card profile-card">
          <button 
            type="button" 
            className="button button-danger account-logout-btn" 
            onClick={handleLogout}
          >
            Вийти
          </button>
          <div className="profile-header">
            <div className="profile-avatar-container">
              <div className="profile-avatar-block">
                <img 
                  src={user?.photo_url || avatarPlaceholder} 
                  alt="Аватар" 
                  className="profile-avatar" 
                />
                <div className="profile-avatar-overlay">
                  <label htmlFor="avatar-upload" className="avatar-edit-icon" title="Змінити фото">
                    <FaPencilAlt />
                  </label>
                  {user?.photo_url && (
                    <button 
                      type="button" 
                      className="avatar-delete-icon" 
                      onClick={handleRemoveAvatar}
                      title="Видалити фото"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
                <input 
                  id="avatar-upload" 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleAvatarUpload} 
                />
              </div>
              <div 
                title={user?.is_active ? 'Активний' : 'Неактивний'}
                className={clsx('profile-status-indicator', user?.is_active ? 'profile-status-active' : 'profile-status-inactive')}
              />
            </div>
            <div className="profile-details">
              <p className="notice">Ваш обліковий запис</p>
              <h2>{user?.full_name || 'Користувач'}</h2>
              <p>@{user?.nickname || 'nickname'}</p>
              <p>{user?.email}</p>
              <p className="profile-created-at">
                Зареєстровано: {user?.created_at ? new Date(user.created_at).toLocaleDateString('uk-UA') : '—'}
              </p>
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
