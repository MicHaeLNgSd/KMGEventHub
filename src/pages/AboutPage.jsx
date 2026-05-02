import Header from '../components/Header'
import Footer from '../components/Footer'

export default function AboutPage() {
  return (
    <div className="page-shell">
      <Header />
      <main className="app-shell">
        <div className="page-card">
          <h2 className="section-title">Про нас</h2>
          <p>
            Offline Event Hub створено для того, щоб полегшити організацію офлайн заходів та
            керування реєстраціями. Додаток об'єднує інформацію про події, локації, учасників
            та дозволяє швидко створювати та відстежувати події.
          </p>
          <p>
            Цей проєкт розробляється як дипломна робота та демонструє вміння працювати з React,
            Vite, Express і PostgreSQL. Мета — створити зручний інструмент для організаторів,
            який допомагає планувати зустрічі, вести облік учасників і налаштовувати офлайн активності.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
