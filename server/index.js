import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool from './db/config.js';

dotenv.config();

const normalizePhoneNumber = (phone) => phone?.trim().replace(/[\s()-]/g, '') || ''
const isValidPhoneNumber = (phone) => {
  if (!phone) return true
  const normalized = normalizePhoneNumber(phone)
  return /^(?:\+?380|0)\d{9}$/.test(normalized)
}

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test database connection
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, full_name, nickname, age, email FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, phone_number, full_name, nickname, age, email, bio, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        e.id, 
        e.title, 
        e.description,
        e.location,
        e.event_date,
        e.max_participants,
        u.id as creator_id,
        u.full_name as creator_name,
        u.nickname as creator_nickname,
        COUNT(ep.id) as participant_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      GROUP BY e.id, u.id
      ORDER BY e.event_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get event by ID with full details
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        e.id, 
        e.title, 
        e.description,
        e.location,
        e.latitude,
        e.longitude,
        e.photo_url,
        e.event_date,
        e.max_participants,
        e.status,
        e.created_at,
        u.id as creator_id,
        u.full_name as creator_name,
        u.nickname as creator_nickname,
        u.email as creator_email,
        u.phone_number as creator_phone
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      WHERE e.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get participants
    const participantsResult = await pool.query(`
      SELECT u.id, u.full_name, u.nickname, u.age, ep.status
      FROM event_participants ep
      LEFT JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = $1
    `, [id]);

    const event = result.rows[0];
    event.participants = participantsResult.rows;
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get events by creator
app.get('/api/users/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT 
        e.id, 
        e.title, 
        e.description,
        e.location,
        e.event_date,
        e.max_participants,
        COUNT(ep.id) as participant_count
      FROM events e
      LEFT JOIN event_participants ep ON e.id = ep.event_id
      WHERE e.creator_id = $1
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user registrations
app.get('/api/users/:userId/registrations', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(`
      SELECT 
        e.id, 
        e.title, 
        e.description,
        e.location,
        e.event_date,
        ep.status,
        ep.registered_at
      FROM event_participants ep
      LEFT JOIN events e ON ep.event_id = e.id
      WHERE ep.user_id = $1
      ORDER BY e.event_date ASC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, nickname, email, password, age, phone_number } = req.body;

    const trimmedName = full_name?.trim();
    const trimmedNickname = nickname?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone_number?.trim();
    const trimmedPassword = password?.trim();
    const parsedAge = age ? parseInt(age, 10) : null;

    if (!trimmedName || !trimmedNickname || !trimmedEmail || !trimmedPassword) {
      return res.status(400).json({ error: 'Поле full_name, nickname, email та password є обов\'язковими.' });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів.' });
    }

    if (parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120)) {
      return res.status(400).json({ error: 'Вік повинен бути числом від 13 до 120.' });
    }

    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      return res.status(400).json({ error: 'Телефон повинен бути у форматі +380XXXXXXXXX або 0XXXXXXXXX.' });
    }

    const userExists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR nickname = $2',
      [trimmedEmail, trimmedNickname]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Користувач з таким email або nickname вже існує.' });
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (phone_number, full_name, nickname, age, email, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name, nickname, age, email, phone_number, created_at, updated_at`,
      [trimmedPhone || null, trimmedName, trimmedNickname, parsedAge, trimmedEmail, passwordHash]
    );

    const newUser = result.rows[0];
    res.status(201).json({ message: 'Користувача створено успішно.', user: newUser });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Помилка сервера при реєстрації.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPassword = password?.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return res.status(400).json({ error: 'Email та пароль є обов\'язковими.' });
    }

    const result = await pool.query(
      'SELECT id, full_name, nickname, age, email, phone_number, password_hash FROM users WHERE email = $1',
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
    res.json({ message: 'Успішний вхід.', user: userData });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Помилка сервера при вході.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, nickname, email, age, phone_number, bio } = req.body;

    const trimmedName = full_name?.trim();
    const trimmedNickname = nickname?.trim();
    const trimmedEmail = email?.trim().toLowerCase();
    const trimmedPhone = phone_number?.trim();
    const trimmedBio = bio?.trim();
    const parsedAge = age ? parseInt(age, 10) : null;

    if (!trimmedName || !trimmedNickname || !trimmedEmail) {
      return res.status(400).json({ error: 'full_name, nickname та email є обов\'язковими.' });
    }

    if (parsedAge !== null && (Number.isNaN(parsedAge) || parsedAge < 13 || parsedAge > 120)) {
      return res.status(400).json({ error: 'Вік повинен бути числом від 13 до 120.' });
    }

    if (trimmedPhone && !isValidPhoneNumber(trimmedPhone)) {
      return res.status(400).json({ error: 'Телефон повинен бути у форматі +380XXXXXXXXX або 0XXXXXXXXX.' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE (email = $1 OR nickname = $2) AND id <> $3',
      [trimmedEmail, trimmedNickname, id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Інший користувач з таким email або nickname вже існує.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           nickname = $2,
           age = $3,
           phone_number = $4,
           email = $5,
           bio = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, full_name, nickname, age, email, phone_number, bio, is_active, created_at, updated_at`,
      [trimmedName, trimmedNickname, parsedAge, trimmedPhone || null, trimmedEmail, trimmedBio || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувача не знайдено.' });
    }

    res.json({ message: 'Профіль успішно оновлено.', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Помилка сервера при оновленні профілю.' });
  }
});

// Create new event
app.post('/api/events', async (req, res) => {
  try {
    const { creator_id, title, description, location, latitude, longitude, event_date, max_participants } = req.body;

    // Валідація
    if (!creator_id || !title || !location || !event_date) {
      return res.status(400).json({ 
        error: 'Обов\'язкові поля: creator_id, title, location, event_date' 
      });
    }

    const result = await pool.query(
      `INSERT INTO events (creator_id, title, description, location, latitude, longitude, event_date, max_participants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, creator_id, title, description, location, latitude, longitude, event_date, max_participants, status, created_at`,
      [creator_id, title, description || null, location, latitude || null, longitude || null, event_date, max_participants || null]
    );

    const newEvent = result.rows[0];
    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Database: ${process.env.POSTGRES_DB || 'kmg_events_db'}`);
});
