import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { validateAge, validatePhone } from '../utils/validators'
import { formatPhoneInput } from '../utils/formatters'

export default function RegisterPage({ setUser }) {
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    age: '',
    phone: '+38',
    email: '',
    password: '',
    role: ''
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleChangePhone = (event) => {
    const { value } = event.target
    const formattedPhone = formatPhoneInput(value)
    setForm((prev) => ({ ...prev, phone: formattedPhone }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedPhone = form.phone.trim()
    const trimmedAge = form.age.trim()

    if (!trimmedPhone || trimmedPhone === '+38') {
      setError('Номер телефону є обов\'язковим.')
      return
    }

    const ageError = validateAge(trimmedAge)
    if (ageError) {
      setError(ageError)
      return
    }

    const phoneError = validatePhone(trimmedPhone)
    if (phoneError) {
      setError(phoneError)
      return
    }

    setIsSubmitting(true)

    try {
      const data = await authService.register({
        full_name: form.name.trim(),
        nickname: form.nickname.trim(),
        age: trimmedAge,
        phone_number: trimmedPhone,
        email: form.email.trim().toLowerCase(),
        password: form.password
      })

      if (data.token) {
        localStorage.setItem('authToken', data.token)
        if (data.user) {
          setUser(data.user)
        }
      }
      navigate('/home')
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Помилка підключення до сервера. Спробуйте пізніше.'
      setError(errorMsg)
      console.error('Register error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell auth-shell">
      <div className="page-card auth-card">
        <h2 className="section-title">Реєстрація нового учасника</h2>
        <form className="auth-grid" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Ім'я</label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ваше ім'я"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="nickname">Прізвисько</label>
            <input
              id="nickname"
              type="text"
              value={form.nickname}
              onChange={(event) => setForm({ ...form, nickname: event.target.value })}
              placeholder="Ваше прізвисько"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="age">Вік</label>
            <input
              id="age"
              type="number"
              min="13"
              max="120"
              value={form.age}
              onChange={(event) => setForm({ ...form, age: event.target.value })}
              placeholder="Ваш вік"
            />
          </div>
          <div className="form-field">
            <label htmlFor="phone">Телефон</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={handleChangePhone}
              placeholder="+380XXXXXXXXX"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="email">Електронна пошта</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="example@mail.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="button" disabled={isSubmitting}>
              {isSubmitting ? 'Зареєструватися...' : 'Зареєструватися'}
            </button>
            <p className="form-note">
              Вже зареєстровані? <Link to="/login">Увійти</Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
