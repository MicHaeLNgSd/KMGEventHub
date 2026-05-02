export default function EventCard({ event, onClick }) {
  return (
    <article
      className="event-card"
      onClick={() => onClick(event.id)}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <h3>{event.title}</h3>
        <span>{event.date}</span>
      </div>
      <p>{event.description}</p>
      <p className="notice">
        <strong>Локація:</strong> {event.location} · <strong>Учасників:</strong>{' '}
        {event.participants}
      </p>
    </article>
  );
}
