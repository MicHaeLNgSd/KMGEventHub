import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import AccountPage from './pages/AccountPage'
import ContactPage from './pages/ContactPage'
import AboutPage from './pages/AboutPage'
import ScrollToTop from './components/ScrollToTop'
import API from './utils/api'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useOnlineStatus()

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      API.get('/auth/me')
        .then((res) => {
          if (res.data.user) {
            setUser(res.data.user)
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const isModerator = user?.role === 'MODERATOR'

  if (loading) {
    return <div className="app-shell"><div className="page-card">Завантаження...</div></div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/account" element={<AccountPage />} />
        {!isModerator && (
          <>
            <Route path="/contacts" element={<ContactPage />} />
            <Route path="/about" element={<AboutPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <ScrollToTop />
    </BrowserRouter>
  )
}

export default App
