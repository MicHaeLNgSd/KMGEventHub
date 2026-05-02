const PHONE_REGEX = /^(?:\+?380|0)\d{9}$/;

export const validateAge = (age) => {
  if (!age) return null; // Вік не є обов'язковим всюди, але якщо він є, то валідуємо
  const numAge = Number(age);
  if (Number.isNaN(numAge) || numAge < 13 || numAge > 120) {
    return 'Вік повинен бути числом від 13 до 120.';
  }
  return null;
};

export const validatePhone = (phone) => {
  if (!phone) return null; // Телефон не завжди обов'язковий
  const digitsOnly = phone.replace(/[^\d+]/g, '');
  if (!PHONE_REGEX.test(digitsOnly)) {
    return 'Телефон повинен бути у форматі +380XXXXXXXXX або 0XXXXXXXXX.';
  }
  return null;
};
