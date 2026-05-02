import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const data = await authService.login({
        email: form.email.trim(),
        password: form.password
      })

      if (data.token) {
        localStorage.setItem('authToken', data.token)
      }
      navigate('/home')
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Помилка підключення до сервера. Спробуйте пізніше.'
      setError(errorMsg)
      console.error('Login error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell auth-shell">
      <div className="page-card auth-card">
        <h2 className="section-title">Вхід до системи</h2>
        <form className="auth-grid" onSubmit={handleSubmit}>
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
              {isSubmitting ? 'Увійти...' : 'Увійти'}
            </button>
            <p className="form-note">
              Ще немає акаунта? <Link to="/register">Зареєструватися</Link>
            </p>
          </div>
        </form>
      </div>
    </main>
  )
}
