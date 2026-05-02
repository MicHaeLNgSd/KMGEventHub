import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-left">
        <Link to="/home">Домівка</Link>
        <Link to="/about">Про нас</Link>
        <Link to="/contacts">Контакти</Link>
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
