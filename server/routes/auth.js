import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/config.js';
import { generateToken } from '../config/jwt.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const normalizePhoneNumber = (phone) => phone?.trim().replace(/[\s()-]/g, '') || ''
const isValidPhoneNumber = (phone) => {
  if (!phone) return true
  const normalized = normalizePhoneNumber(phone)
  return /^(?:\+?380|0)\d{9}$/.test(normalized)
}

// Registration
router.post('/register', async (req, res) => {
  try {
    const { full_name, nickname, email, password, age, phone_number } = req.body;

    const trimmedName = full_name?.trim();
    const trimmedNickname = nickname?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone_number?.trim();
    const trimmedPassword = password?.trim();
    const parsedAge = age ? parseInt(age, 10) : null;

    if (!trimmedName || !trimmedNickname || !trimmedEmail || !trimmedPassword || !trimmedPhone || trimmedPhone === '+38') {
      return res.status(400).json({ error: 'Поля full_name, nickname, email, password та phone_number є обов\'язковими.' });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів.' });
    }

    if (parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120)) {
      return res.status(400).json({ error: 'Вік повинен бути числом від 13 до 120.' });
    }

    if (!isValidPhoneNumber(trimmedPhone)) {
      return res.status(400).json({ error: 'Телефон повинен бути у форматі +380XXXXXXXXX.' });
    }

    const userExists = await pool.query(
      'SELECT email, nickname, phone_number FROM users WHERE email = $1 OR nickname = $2 OR phone_number = $3',
      [trimmedEmail, trimmedNickname, trimmedPhone]
    );

    if (userExists.rows.length > 0) {
      const existing = userExists.rows[0];
      if (existing.email === trimmedEmail) return res.status(409).json({ error: 'Користувач з таким email вже існує.' });
      if (existing.nickname === trimmedNickname) return res.status(409).json({ error: 'Користувач з таким nickname вже існує.' });
      if (existing.phone_number === trimmedPhone) return res.status(409).json({ error: 'Користувач з таким номером телефону вже існує.' });
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (phone_number, full_name, nickname, age, email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, nickname, age, email, phone_number, role, created_at, updated_at`,
      [trimmedPhone || null, trimmedName, trimmedNickname, parsedAge, trimmedEmail, passwordHash]
    );

    const newUser = result.rows[0];
    const token = generateToken({ id: newUser.id, email: newUser.email });
    res.status(201).json({ message: 'Користувача створено успішно.', token, user: { id: newUser.id, full_name: newUser.full_name, nickname: newUser.nickname, role: newUser.role } });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Помилка сервера при реєстрації.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPassword = password?.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({ error: 'Email та пароль є обов\'язковими.' });
    }

    const result = await pool.query(
      'SELECT id, full_name, nickname, age, email, phone_number, password_hash, role, is_banned FROM users WHERE email = $1',
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Невірний email або пароль.' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(trimmedPassword, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Невірний email або пароль.' });
    }

    const { password_hash, ...userData } = user;
    if (user.is_banned) {
      return res.status(403).json({ error: 'Цей акаунт заблоковано модератором.' });
    }
    const token = generateToken({ id: userData.id, email: userData.email });
    res.json({ message: 'Успішний вхід.', token, user: { id: userData.id, full_name: userData.full_name, nickname: userData.nickname, role: userData.role } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Помилка сервера при вході.' });
  }
});

// Me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, full_name, nickname, role, photo_url FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
