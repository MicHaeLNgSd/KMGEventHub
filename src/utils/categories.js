export const EVENT_CATEGORIES = [
  { id: 'board_games', label: 'Настільні ігри' },
  { id: 'book_club', label: 'Читацькі зустрічі' },
  { id: 'street_sports', label: 'Дворові спортивні активності' },
  { id: 'local_meetup', label: 'Локальні зібрання' },
  { id: 'other', label: 'Інше' }
];

export const getCategoryLabel = (id) => {
  const category = EVENT_CATEGORIES.find(c => c.id === id);
  return category ? category.label : 'Без категорії';
};
