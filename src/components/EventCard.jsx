import { formatRelative } from 'date-fns';
import { uk } from 'date-fns/locale';
import { FaCalendarAlt } from 'react-icons/fa';
import './EventCard.css';

export default function EventCard({ event, onClick }) {
  const date = new Date(event.event_date);
  const relativeDate = formatRelative(date, new Date(), { locale: uk });
  const formattedDate = relativeDate.charAt(0).toUpperCase() + relativeDate.slice(1);

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
          <span className="event-date">{formattedDate}</span>
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
