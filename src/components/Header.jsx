import { Link } from 'react-router-dom'
import { useState } from 'react'
import clsx from 'clsx'
import { FaBars, FaTimes } from 'react-icons/fa'

export default function Header({ currentUser: user }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isModerator = user?.role === 'MODERATOR'

  return (
    <header className={clsx('site-header', isModerator && 'moderator-header')}>
      <div className="header-left">
        <Link to="/home" className="brand-link" onClick={() => setMenuOpen(false)}>
          <span className={clsx('brand-logo', isModerator && 'moderator')}>KMG</span>
          <span className="brand-name">Offline Event Hub</span>
        </Link>
      </div>
      <button className="burger-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>
      <nav className={clsx('header-nav', menuOpen && 'open')}>
        {!isModerator && (
          <>
            <Link to="/about" onClick={() => setMenuOpen(false)}>Про нас</Link>
            <Link to="/contacts" onClick={() => setMenuOpen(false)}>Контакти</Link>
          </>
        )}
        <Link to="/account" className="header-account-link" onClick={() => setMenuOpen(false)}>
          {user?.photo_url ? (
            <img src={user.photo_url} alt="Profile" className="header-avatar" />
          ) : (
            <span className="header-avatar-placeholder">{user?.full_name?.charAt(0).toUpperCase() || 'U'}</span>
          )}
          Аккаунт
        </Link>
      </nav>
    </header>
  )
}
