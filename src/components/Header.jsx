import { Link } from 'react-router-dom'

export default function Header() {
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
        <Link to="/about">Про нас</Link>
        <Link to="/contacts">Контакти</Link>
        <Link to="/account">Аккаунт</Link>
      </nav>
    </header>
  )
}
