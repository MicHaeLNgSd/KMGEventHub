import './EventCard.css';

export default function EventCard({ event, onClick }) {
  return (
    <article
      className="event-card event-card-clickable"
      onClick={() => onClick(event.id)}
    >
      <div className="event-card-header">
        <h3>{event.title}</h3>
        <span>{event.date}</span>
      </div>
      <p>{event.description}</p>
      <p className="notice">
        <strong>Локація:</strong> {event.location} · <strong>Учасників:</strong>{' '}
        {event.participants} / {event.max_participants || '∞'}
      </p>
    </article>
  );
}
