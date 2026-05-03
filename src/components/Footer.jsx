import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import API from '../utils/api'

export default function Footer() {
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
    <footer className="site-footer">
      <div className="footer-left">
        {!isModerator && (
          <>
            <Link to="/about">Про нас</Link>
            <Link to="/contacts">Контакти</Link>
          </>
        )}
        <Link to="/account">Аккаунт</Link>
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
  )
}
