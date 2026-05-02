import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import API from '../utils/api'

export default function Header() {
  const [user, setUser] = useState(null)

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
    }
  }, [])

  const isModerator = user?.role === 'MODERATOR'

  return (
    <header className="site-header">
      <div className="header-left">
        <Link to="/home" className="brand-link">
          <span className="brand-logo">KMG</span>
          <span className="brand-name">Offline Event Hub</span>
        </Link>
      </div>
      <nav className="header-nav">
        <Link to="/home">Домівка</Link>
        {!isModerator && (
          <>
            <Link to="/about">Про нас</Link>
            <Link to="/contacts">Контакти</Link>
          </>
        )}
        <Link to="/account">Аккаунт</Link>
      </nav>
    </header>
  )
}
