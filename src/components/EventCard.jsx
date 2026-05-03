import { FaCalendarAlt } from 'react-icons/fa';
import './EventCard.css';

export default function EventCard({ event, onClick }) {
  const eventDate = new Date(event.event_date).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <article
      className="event-card event-card-clickable"
      onClick={() => onClick(event.id)}
    >
      <div className="event-card-photo">
        {event.photo_url ? (
          <img src={event.photo_url} alt={event.title} />
        ) : (
          <FaCalendarAlt size={30} />
        )}
      </div>
      <div className="event-card-info">
        <div className="event-card-header">
          <h3>{event.title}</h3>
          <span className="event-date">{eventDate}</span>
        </div>
        <p className="event-description">{event.description}</p>
        <div className="event-footer">
          <p className="notice">
            <strong>Локація:</strong> {event.location}
          </p>
          <p className="notice">
            <strong>Учасників:</strong> {event.participant_count} / {event.max_participants || '∞'}
          </p>
        </div>
      </div>
    </article>
  );
}
