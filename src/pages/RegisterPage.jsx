import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const PHONE_REGEX = /^(?:\+?380|0)\d{9}$/

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    nickname: '',
    age: '',
    phone: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedPhone = form.phone.trim()
    const trimmedAge = form.age.trim()

    if (trimmedAge && (Number.isNaN(Number(trimmedAge)) || Number(trimmedAge) < 13 || Number(trimmedAge) > 120)) {
      setError('Вік повинен бути числом від 13 до 120.')
      return
    }

    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone.replace(/[^\d+]/g, ''))) {
      setError('Телефон повинен бути у форматі +380XXXXXXXXX або 0XXXXXXXXX.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.name.trim(),
          nickname: form.nickname.trim(),
          age: trimmedAge,
          phone_number: trimmedPhone,
          email: form.email.trim().toLowerCase(),
          password: form.password
        })
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Не вдалося зареєструватися. Перевірте дані.')
        return
      }

      if (data.user) {
        localStorage.setItem('currentUser', JSON.stringify(data.user))
      }
      navigate('/home')
    } catch (fetchError) {
      setError('Помилка підключення до сервера. Спробуйте пізніше.')
      console.error('Register error:', fetchError)
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
            <label htmlFor="phone">Телефон (необов'язково)</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder="380XXXXXXXXX"
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
