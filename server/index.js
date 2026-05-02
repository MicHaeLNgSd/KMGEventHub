import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './db/config.js';
import { generateToken, verifyToken } from './config/jwt.js';

dotenv.config();

const normalizePhoneNumber = (phone) => phone?.trim().replace(/[\s()-]/g, '') || ''
const isValidPhoneNumber = (phone) => {
  if (!phone) return true
  const normalized = normalizePhoneNumber(phone)
  return /^(?:\+?380|0)\d{9}$/.test(normalized)
}

const app = express();
const PORT = process.env.SERVER_PORT || 3000;
const httpServer = createServer(app);

// Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  try {
    const decoded = verifyToken(token);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io Connection & Events
io.on('connection', (socket) => {
  console.log(`User connected to socket: ${socket.user.id}`);

  socket.on('joinEvent', (eventId) => {
    socket.join(`event_${eventId}`);
    console.log(`User ${socket.user.id} joined event_${eventId}`);
  });

  socket.on('leaveEvent', (eventId) => {
    socket.leave(`event_${eventId}`);
    console.log(`User ${socket.user.id} left event_${eventId}`);
  });

  socket.on('sendMessage', async (data) => {
    try {
      const { eventId, text } = data;
      const senderId = socket.user.id;

      if (!text || !text.trim()) return;

      const result = await pool.query(
        `INSERT INTO messages (event_id, sender_id, text)
         VALUES ($1, $2, $3)
         RETURNING id, text, created_at`,
        [eventId, senderId, text.trim()]
      );

      const message = result.rows[0];
      const userResult = await pool.query('SELECT id, full_name, nickname FROM users WHERE id = $1', [senderId]);
      const sender = userResult.rows[0];

      const newMessage = {
        id: message.id,
        text: message.text,
        created_at: message.created_at,
        sender_id: sender.id,
        sender_name: sender.full_name,
        sender_nickname: sender.nickname
      };

      io.to(`event_${eventId}`).emit('newMessage', newMessage);
    } catch (err) {
      console.error('Socket sendMessage error:', err);
      socket.emit('messageError', { error: 'Помилка при відправці повідомлення' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected from socket: ${socket.user.id}`);
  });
});

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token);
    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

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

// Update online status
app.put('/api/users/status', authenticateToken, async (req, res) => {
  try {
    const { is_active } = req.body;
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Offline beacon endpoint (no auth middleware because it uses sendBeacon)
app.post('/api/users/offline', async (req, res) => {
  try {
    let token = req.query.token;
    
    if (!token && req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token) return res.status(400).json({ error: 'Token required' });
    
    const decoded = verifyToken(token);
    await pool.query('UPDATE users SET is_active = false WHERE id = $1', [decoded.id]);
    res.json({ success: true });
  } catch (error) {
    // We ignore invalid token errors for beacon
    res.status(400).json({ error: 'Invalid or expired token' });
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
        e.category,
        u.id as creator_id,
        u.full_name as creator_name,
        u.nickname as creator_nickname,
        COUNT(ep.id) as participant_count,
        COALESCE(json_agg(ep.user_id) FILTER (WHERE ep.user_id IS NOT NULL), '[]'::json) as participant_ids
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.status IN ('approved', 'pending', 'registered')
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
        e.is_private,
        e.category,
        e.created_at,
        e.updated_at,
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
    const token = generateToken({ id: userData.id, email: userData.email });
    res.json({ message: 'Успішний вхід.', token, user: { id: userData.id, full_name: userData.full_name, nickname: userData.nickname, role: userData.role } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Помилка сервера при вході.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, full_name, nickname, role FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: userResult.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const { title, description, location, latitude, longitude, event_date, max_participants, is_private, category } = req.body;
    const creator_id = req.user.id;

    // Валідація
    if (!creator_id || !title || !location || !event_date) {
      return res.status(400).json({ 
        error: 'Обов\'язкові поля: creator_id, title, location, event_date' 
      });
    }

    const result = await pool.query(
      `INSERT INTO events (creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category, status, created_at`,
      [creator_id, title, description || null, location, latitude || null, longitude || null, event_date, max_participants || null, is_private || false, category || null]
    );

    const newEvent = result.rows[0];
    res.status(201).json(newEvent);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update event
app.put('/api/events/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, latitude, longitude, event_date, max_participants, is_private, category } = req.body;

    // Перевірити, чи користувач має право редагувати
    const eventResult = await pool.query('SELECT creator_id FROM events WHERE id = $1', [id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventResult.rows[0];
    if (event.creator_id !== req.user.id && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ error: 'Недостатньо прав для редагування події' });
    }

    if (!title || !location || !event_date) {
      return res.status(400).json({
        error: 'Обов\'язкові поля: title, location, event_date'
      });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           location = $3,
           latitude = $4,
           longitude = $5,
           event_date = $6,
           max_participants = $7,
           is_private = $8,
           category = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING id, creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category, status, created_at, updated_at`,
      [title, description || null, location, latitude || null, longitude || null, event_date, max_participants || null, is_private || false, category || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete event
app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully', eventId: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Join event
app.post('/api/events/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is already a participant
    const existing = await pool.query('SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2', [id, userId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ви вже є учасником цього заходу' });
    }

    const result = await pool.query(
      "INSERT INTO event_participants (event_id, user_id, status) VALUES ($1, $2, 'pending') RETURNING id, status",
      [id, userId]
    );

    res.status(201).json({ message: 'Ви успішно приєдналися до заходу', participant: result.rows[0] });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Leave event
app.delete('/api/events/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ви не є учасником цього заходу' });
    }

    res.json({ message: 'Ви успішно покинули захід' });
  } catch (error) {
    console.error('Error leaving event:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for event
app.get('/api/events/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT m.id, m.text, m.created_at, u.id as sender_id, u.full_name as sender_name, u.nickname as sender_nickname
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.event_id = $1
      ORDER BY m.created_at ASC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message to event
app.post('/api/events/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const sender_id = req.user.id;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Повідомлення не може бути порожнім' });
    }

    const result = await pool.query(
      `INSERT INTO messages (event_id, sender_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, text, created_at`,
      [id, sender_id, text.trim()]
    );

    const message = result.rows[0];
    const userResult = await pool.query('SELECT id, full_name, nickname FROM users WHERE id = $1', [sender_id]);
    const sender = userResult.rows[0];

    res.status(201).json({
      id: message.id,
      text: message.text,
      created_at: message.created_at,
      sender_id: sender.id,
      sender_name: sender.full_name,
      sender_nickname: sender.nickname
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Database: ${process.env.POSTGRES_DB || 'kmg_events_db'}`);
});
