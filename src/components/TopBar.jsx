import { useNavigate } from 'react-router-dom'

export default function TopBar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    navigate('/login')
  }

  return (
    <div className="topbar">
      <div>
        <h1 className="brand-title">Offline Event Hub</h1>
        <p className="brand-subtitle">Керування реєстрацією, пошук івентів та планування подій</p>
      </div>
      <div className="button-group">
        <button type="button" className="button-alt" onClick={handleLogout}>Вийти</button>
      </div>
    </div>
  )
}
