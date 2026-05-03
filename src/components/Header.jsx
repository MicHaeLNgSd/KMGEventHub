import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import API from '../utils/api'

export default function Header({ currentUser: user }) {

  const isModerator = user?.role === 'MODERATOR'

  return (
    <header className={clsx('site-header', isModerator && 'admin-header')}>
      <div className="header-left">
        <Link to="/home" className="brand-link">
          <span className={clsx('brand-logo', isModerator && 'admin')}>KMG</span>
          <span className="brand-name">Offline Event Hub</span>
        </Link>
      </div>
      <nav className="header-nav">
        {!isModerator && (
          <>
            <Link to="/about">Про нас</Link>
            <Link to="/contacts">Контакти</Link>
          </>
        )}
        <Link to="/account" className="header-account-link">
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
