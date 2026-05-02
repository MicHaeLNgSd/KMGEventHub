export default function EventFormPanel({
  selectedEvent,
  currentUser,
  isModerator,
  formData,
  formError,
  submitting,
  isEditMode,
  hasEventAccess,
  handleFormChange,
  handleCreateEvent,
  handleDeleteEvent,
  onClose,
  showDeleteConfirm,
  setShowDeleteConfirm
}) {
  return (
    <>
      <aside className="create-event-panel">
        <div className="panel-header">
          <h2>{selectedEvent ? 'Деталі заходу' : 'Створити новий захід'}</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Закрити панель"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreateEvent} className="create-event-form">
          {isEditMode && !hasEventAccess && (
            <div className="notice" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
              📖 Ви можете лише переглядати цей захід
            </div>
          )}

          {formError && (
            <div className="form-error">
              <p>❌ {formError}</p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Назва заходу *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleFormChange}
              placeholder="Турнір Catan, Вечір ігор, тощо"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Місце проведення *</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleFormChange}
              placeholder="Адреса або назва закладу"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="latitude">Широта</label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={formData.latitude}
                onChange={handleFormChange}
                placeholder="50.4501"
                step="0.0001"
              />
            </div>
            <div className="form-group">
              <label htmlFor="longitude">Довгота</label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={formData.longitude}
                onChange={handleFormChange}
                placeholder="30.5234"
                step="0.0001"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="event_date">Дата та час *</label>
            <input
              type="datetime-local"
              id="event_date"
              name="event_date"
              value={formData.event_date}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="max_participants">Максимальна кількість учасників</label>
            <input
              type="number"
              id="max_participants"
              name="max_participants"
              value={formData.max_participants}
              onChange={handleFormChange}
              placeholder="16"
              min="1"
            />
          </div>

          {(!isEditMode || hasEventAccess) && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
              <label htmlFor="is_private" style={{ margin: 0 }}>Приватний захід</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  id="is_private"
                  name="is_private"
                  checked={formData.is_private}
                  onChange={handleFormChange}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              {selectedEvent ? 'Закрити' : 'Скасувати'}
            </button>
            {isEditMode && (selectedEvent?.creator_id === currentUser?.id || isModerator) && (
              <button
                type="button"
                className="button button-danger"
                onClick={() => setShowDeleteConfirm(true)}
                title="Видалити захід"
              >
                🗑️
              </button>
            )}
            {(!isEditMode || hasEventAccess) && (
              <button
                type="submit"
                className="button button-primary"
                disabled={submitting}
              >
                {submitting
                  ? (selectedEvent ? 'Збереження...' : 'Створення...')
                  : (selectedEvent ? 'Зберегти' : 'Створити захід')}
              </button>
            )}
          </div>
        </form>
      </aside>
      
      {showDeleteConfirm && (
        <div className="delete-confirm-modal">
          <div className="delete-confirm-content">
            <h3>Видалити захід?</h3>
            <p>Ви впевнені, що хочете видалити захід <strong>{selectedEvent?.title}</strong>?</p>
            <p className="delete-confirm-warning">Ця дія не може бути скасована.</p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={submitting}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={handleDeleteEvent}
                disabled={submitting}
              >
                {submitting ? 'Видалення...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
