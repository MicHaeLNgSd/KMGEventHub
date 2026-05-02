import Header from '../components/Header'
import Footer from '../components/Footer'

export default function ContactPage() {
  return (
    <div className="page-shell">
      <Header />
      <main className="app-shell">
        <div className="page-card">
          <h2 className="section-title">Контакти</h2>
          <p>
            Якщо у вас є питання або пропозиції, ви можете зв'язатися з нами будь-коли.
            Ми відповідаємо на запити щодо участі, організації заходів та технічної підтримки.
          </p>
          <div className="contact-list">
            <p><strong>Електронна пошта:</strong> support@kmgevent.com</p>
            <p><strong>Телефон:</strong> +38 (050) 961-1945</p>
            <p><strong>Адреса:</strong> м. Київ, Україна</p>
          </div>
          <p>
            Ми готові допомогти вам у виборі формату івенту, створенні та координації офлайн заходів.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
