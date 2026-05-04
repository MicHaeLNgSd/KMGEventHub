import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

const __dirname = path.resolve();
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Socket.io initialization
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png, gif, webp) are allowed'));
  }
});

// Socket.io Auth
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

// Socket Events
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
  
  socket.on('joinPersonalRoom', (userId) => {
    // Only own room
    if (socket.user.id === parseInt(userId, 10)) {
      socket.join(`user_${userId}`);
      console.log(`User ${socket.user.id} joined personal room user_${userId}`);
    }
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
      const userResult = await pool.query('SELECT id, full_name, nickname, photo_url FROM users WHERE id = $1', [senderId]);
      const sender = userResult.rows[0];

      const newMessage = {
        id: message.id,
        text: message.text,
        created_at: message.created_at,
        sender_id: sender.id,
        sender_name: sender.full_name,
        sender_nickname: sender.nickname,
        sender_photo: sender.photo_url
      };

      io.to(`event_${eventId}`).emit('newMessage', newMessage);
    } catch (err) {
      console.error('Socket sendMessage error:', err);
      socket.emit('messageError', { error: 'Помилка при відправці повідомлення' });
    }
  });

  socket.on('joinDirectChat', (friendId) => {
    const minId = Math.min(socket.user.id, parseInt(friendId, 10));
    const maxId = Math.max(socket.user.id, parseInt(friendId, 10));
    socket.join(`direct_${minId}_${maxId}`);
    console.log(`User ${socket.user.id} joined direct_${minId}_${maxId}`);
  });

  socket.on('leaveDirectChat', (friendId) => {
    const minId = Math.min(socket.user.id, parseInt(friendId, 10));
    const maxId = Math.max(socket.user.id, parseInt(friendId, 10));
    socket.leave(`direct_${minId}_${maxId}`);
    console.log(`User ${socket.user.id} left direct_${minId}_${maxId}`);
  });

  socket.on('sendDirectMessage', async (data) => {
    try {
      const { receiverId, text } = data;
      const senderId = socket.user.id;

      if (!text || !text.trim() || !receiverId) return;

      const result = await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, text)
         VALUES ($1, $2, $3)
         RETURNING id, text, created_at`,
        [senderId, receiverId, text.trim()]
      );

      const message = result.rows[0];
      const userResult = await pool.query('SELECT id, full_name, nickname, photo_url FROM users WHERE id = $1', [senderId]);
      const sender = userResult.rows[0];

      const newMessage = {
        id: message.id,
        text: message.text,
        created_at: message.created_at,
        sender_id: sender.id,
        receiver_id: receiverId,
        sender_name: sender.full_name,
        sender_nickname: sender.nickname,
        sender_photo: sender.photo_url
      };

      const minId = Math.min(senderId, parseInt(receiverId, 10));
      const maxId = Math.max(senderId, parseInt(receiverId, 10));
      io.to(`direct_${minId}_${maxId}`).emit('newDirectMessage', newMessage);
      
      // Notify receiver for chat list update
      io.to(`user_${receiverId}`).emit('chatListUpdate', newMessage);
      io.to(`user_${senderId}`).emit('chatListUpdate', newMessage);
    } catch (err) {
      console.error('Socket sendDirectMessage error:', err);
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
    const userResult = await pool.query('SELECT id, role, is_banned FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account is banned' });
    }
    
    req.user = user;
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

// Generic Upload endpoint
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users with friendship status relative to current user
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT 
        u.id, u.full_name, u.nickname, u.age, u.email, u.photo_url,
        uf.status as friendship_status,
        uf.user_id as requester_id
      FROM users u
      LEFT JOIN user_friends uf ON 
        (uf.user_id = $1 AND uf.friend_id = u.id) OR 
        (uf.user_id = u.id AND uf.friend_id = $1)
      WHERE u.id <> $1
      ORDER BY u.created_at DESC
    `, [userId]);
    
    // Process block status
    const users = result.rows.map(row => {
      if (row.friendship_status === 'blocked') {
        row.is_blocked_by_me = (row.requester_id === userId);
      }
      return row;
    });

    res.json(users);
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

// Offline beacon
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
    const result = await pool.query('SELECT id, phone_number, full_name, nickname, age, email, bio, photo_url, is_active, created_at, updated_at FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FRIENDSHIP ENDPOINTS

// Get pending friend requests
app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT u.id, u.full_name, u.nickname, u.photo_url, uf.created_at
      FROM user_friends uf
      JOIN users u ON uf.user_id = u.id
      WHERE uf.friend_id = $1 AND uf.status = 'pending'
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send friend request
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    if (userId === parseInt(friendId)) {
      return res.status(400).json({ error: 'Cannot add yourself as friend' });
    }

    // Check if record exists
    const existing = await pool.query(
      'SELECT status FROM user_friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Relation already exists' });
    }

    await pool.query(
      'INSERT INTO user_friends (user_id, friend_id, status) VALUES ($1, $2, \'pending\')',
      [userId, friendId]
    );

    // Notify target real-time
    const senderInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
    io.to(`user_${friendId}`).emit('friendRequestReceived', { fromUserId: userId, fromName: senderInfo.rows[0]?.full_name });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept friend request
app.put('/api/friends/accept', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;

    const result = await pool.query(
      'UPDATE user_friends SET status = \'accepted\' WHERE user_id = $1 AND friend_id = $2 AND status = \'pending\' RETURNING id',
      [friendId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Notify the original requester that their request was accepted
    const acceptorInfo = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
    io.to(`user_${friendId}`).emit('friendRequestAccepted', { byUserId: userId, byName: acceptorInfo.rows[0]?.full_name });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Friend removal
app.delete('/api/friends/remove', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.query;

    await pool.query(
      'DELETE FROM user_friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );

    // Notify the other user
    io.to(`user_${friendId}`).emit('friendRemoved', { byUserId: userId });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Block user
app.post('/api/friends/block', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.body;
    
    console.log(`User ${userId} blocking user ${friendId}`);

    // Reset relation to avoid conflicts
    await pool.query(
      'DELETE FROM user_friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );

    // Insert block status
    await pool.query(`
      INSERT INTO user_friends (user_id, friend_id, status)
      VALUES ($1, $2, 'blocked')
    `, [userId, friendId]);

    // Clear chat history
    await pool.query(
      'DELETE FROM messages WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
      [userId, friendId]
    );

    // Notify blocked user
    io.to(`user_${friendId}`).emit('userBlocked', { byUserId: userId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unblock user
app.delete('/api/friends/unblock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.query;

    await pool.query(
      'DELETE FROM user_friends WHERE user_id = $1 AND friend_id = $2 AND status = \'blocked\'',
      [userId, friendId]
    );

    // Notify unblocked user
    io.to(`user_${friendId}`).emit('userUnblocked', { byUserId: userId });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Ban user
app.put('/api/users/:id/ban', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'MODERATOR') {
      return res.status(403).json({ error: 'Only admins can ban users' });
    }
    const { id } = req.params;
    await pool.query('UPDATE users SET is_banned = true WHERE id = $1', [id]);

    // Force-disconnect banned user immediately
    io.to(`user_${id}`).emit('accountBanned', {});

    res.json({ success: true, message: 'User banned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Unban user
app.put('/api/users/:id/unban', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'MODERATOR') {
      return res.status(403).json({ error: 'Only admins can unban users' });
    }
    const { id } = req.params;
    await pool.query('UPDATE users SET is_banned = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'User unbanned' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin/Author: Remove participant from event
app.delete('/api/events/:id/participants/:userId', authenticateToken, async (req, res) => {
  try {
    const { id: eventId, userId: participantId } = req.params;
    const userId = req.user.id;

    // Check if requester is author or admin
    const eventResult = await pool.query('SELECT creator_id FROM events WHERE id = $1', [eventId]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    
    const event = eventResult.rows[0];
    if (event.creator_id !== userId && req.user.role !== 'MODERATOR') {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.query('DELETE FROM event_participants WHERE event_id = $1 AND user_id = $2', [eventId, participantId]);

    // Notify the kicked user
    const eventInfo = await pool.query('SELECT title FROM events WHERE id = $1', [eventId]);
    io.to(`user_${participantId}`).emit('kickedFromEvent', { eventId: parseInt(eventId), eventTitle: eventInfo.rows[0]?.title });

    // Notify all event participants so their UI updates
    io.to(`event_${eventId}`).emit('participantLeft', { eventId: parseInt(eventId), userId: parseInt(participantId) });

    res.json({ success: true, message: 'Participant removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events with optional filtering
app.get('/api/events', async (req, res) => {
  try {
    const { 
      category, 
      minParticipants, 
      maxParticipants, 
      startDate, 
      userId, 
      myEvents, 
      joinedEvents,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;

    let queryText = `
      SELECT 
        e.id, 
        e.title, 
        e.description,
        e.location,
        e.event_date,
        e.max_participants,
        e.category,
        e.photo_url,
        u.id as creator_id,
        u.full_name as creator_name,
        u.nickname as creator_nickname,
        COUNT(DISTINCT ep.id) as participant_count,
        COALESCE(json_agg(DISTINCT ep.user_id) FILTER (WHERE ep.user_id IS NOT NULL), '[]'::json) as participant_ids,
        COUNT(*) OVER() as total_count
      FROM events e
      LEFT JOIN users u ON e.creator_id = u.id
      LEFT JOIN event_participants ep ON e.id = ep.event_id AND ep.status IN ('approved', 'pending', 'registered')
    `;

    const whereClauses = [];
    const queryParams = [];

    if (category) {
      whereClauses.push(`e.category = $${queryParams.length + 1}`);
      queryParams.push(category);
    }

    if (startDate) {
      whereClauses.push(`e.event_date::date = CAST($${queryParams.length + 1} AS DATE)`);
      queryParams.push(startDate);
    } else if (myEvents !== 'true' && joinedEvents !== 'true') {
      // By default, hide past events for general browsing
      whereClauses.push(`e.event_date >= NOW() - INTERVAL '1 day'`);
    }

    if (search) {
      whereClauses.push(`(e.title ILIKE $${queryParams.length + 1} OR e.description ILIKE $${queryParams.length + 1} OR e.location ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
    }

    if (userId) {
      if (myEvents === 'true') {
        whereClauses.push(`e.creator_id = $${queryParams.length + 1}`);
        queryParams.push(userId);
      } else if (joinedEvents === 'true') {
        whereClauses.push(`e.id IN (SELECT event_id FROM event_participants WHERE user_id = $${queryParams.length + 1} AND status IN ('approved', 'pending', 'registered'))`);
        queryParams.push(userId);
      } else {
        // General list: hide private events unless admin or friend
        // Also hide events from people who blocked the viewer
        const currentParam = queryParams.length + 1;
        whereClauses.push(`(
          e.is_private = false 
          OR e.creator_id = $${currentParam} 
          OR EXISTS (
            SELECT 1 FROM user_friends 
            WHERE status = 'accepted' 
            AND (
              (user_id = e.creator_id AND friend_id = $${currentParam}) OR 
              (friend_id = e.creator_id AND user_id = $${currentParam})
            )
          )
        )`);
        
        // Block logic: hide events from people who blocked me OR whom I blocked
        whereClauses.push(`NOT EXISTS (
          SELECT 1 FROM user_friends 
          WHERE status = 'blocked' 
          AND (
            (user_id = e.creator_id AND friend_id = $${currentParam}) OR 
            (friend_id = e.creator_id AND user_id = $${currentParam})
          )
        )`);
        queryParams.push(userId);
      }
    } else {
      // No userId (unauthenticated) - hide all private events
      whereClauses.push(`e.is_private = false`);
    }

    if (whereClauses.length > 0) {
      queryText += ' WHERE ' + whereClauses.join(' AND ');
    }

    queryText += ' GROUP BY e.id, u.id';

    // Min/Max participants check (current participants)
    if (minParticipants || maxParticipants) {
      const havingClauses = [];
      if (minParticipants) {
        havingClauses.push(`COUNT(DISTINCT ep.id) >= $${queryParams.length + 1}`);
        queryParams.push(parseInt(minParticipants, 10));
      }
      if (maxParticipants) {
        // Here maxParticipants means the USER'S FILTER for max limit
        havingClauses.push(`e.max_participants <= $${queryParams.length + 1}`);
        queryParams.push(parseInt(maxParticipants, 10));
      }
      if (havingClauses.length > 0) {
        queryText += ' HAVING ' + havingClauses.join(' AND ');
      }
    }

    queryText += ` ORDER BY e.event_date ASC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parsedLimit, offset);

    const result = await pool.query(queryText, queryParams);
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    
    res.json({
      events: result.rows,
      totalCount,
      totalPages: Math.ceil(totalCount / parsedLimit),
      currentPage: parsedPage
    });
  } catch (error) {
    console.error('Error fetching events:', error);
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
      SELECT u.id, u.full_name, u.nickname, u.age, u.photo_url, ep.status
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

app.post('/api/auth/login', async (req, res) => {
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
      return res.status(403).json({ error: 'Цей акаунт заблоковано адміністратором.' });
    }
    const token = generateToken({ id: userData.id, email: userData.email });
    res.json({ message: 'Успішний вхід.', token, user: { id: userData.id, full_name: userData.full_name, nickname: userData.nickname, role: userData.role } });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Помилка сервера при вході.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
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

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, nickname, email, age, phone_number, bio, photo_url } = req.body;

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
      return res.status(400).json({ error: 'Телефон повинен бути у форматі +380XXXXXXXXX.' });
    }

    const existingUser = await pool.query(
      'SELECT email, nickname, phone_number FROM users WHERE (email = $1 OR nickname = $2 OR phone_number = $3) AND id <> $4',
      [trimmedEmail, trimmedNickname, trimmedPhone, id]
    );

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      if (existing.email === trimmedEmail) return res.status(409).json({ error: 'Інший користувач з таким email вже існує.' });
      if (existing.nickname === trimmedNickname) return res.status(409).json({ error: 'Інший користувач з таким nickname вже існує.' });
      if (existing.phone_number === trimmedPhone) return res.status(409).json({ error: 'Інший користувач з таким номером телефону вже існує.' });
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           nickname = $2,
           age = $3,
           phone_number = $4,
           email = $5,
           bio = $6,
           photo_url = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, full_name, nickname, age, email, phone_number, bio, photo_url, is_active, created_at, updated_at`,
      [trimmedName, trimmedNickname, parsedAge, trimmedPhone || null, trimmedEmail, trimmedBio || null, photo_url || null, id]
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
    const { title, description, location, latitude, longitude, event_date, max_participants, is_private, category, photo_url } = req.body;
    const creator_id = req.user.id;

    // Validation
    if (!creator_id || !title || !location || !event_date) {
      return res.status(400).json({ 
        error: 'Обов\'язкові поля: creator_id, title, location, event_date' 
      });
    }

    const result = await pool.query(
      `INSERT INTO events (creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category, photo_url, status, created_at`,
      [creator_id, title, description || null, location, latitude || null, longitude || null, event_date, max_participants || null, is_private || false, category || null, photo_url || null]
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
    const { title, description, location, latitude, longitude, event_date, max_participants, is_private, category, photo_url } = req.body;

    // Check if user has permission to edit
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
           photo_url = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING id, creator_id, title, description, location, latitude, longitude, event_date, max_participants, is_private, category, photo_url, status, created_at, updated_at`,
      [title, description || null, location, latitude || null, longitude || null, event_date, max_participants || null, is_private || false, category || null, photo_url || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Notify participants
    io.to(`event_${id}`).emit('eventUpdated', { eventId: parseInt(id), event: result.rows[0] });

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

    // Notify participants
    io.to(`event_${id}`).emit('eventDeleted', { eventId: parseInt(id) });

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

    // Check if already participant
    const existing = await pool.query('SELECT id FROM event_participants WHERE event_id = $1 AND user_id = $2', [id, userId]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Ви вже є учасником цього заходу' });
    }

    const result = await pool.query(
      "INSERT INTO event_participants (event_id, user_id, status) VALUES ($1, $2, 'pending') RETURNING id, status",
      [id, userId]
    );

    // Notify event chat about new participant
    const userInfo = await pool.query('SELECT id, full_name, nickname, photo_url FROM users WHERE id = $1', [userId]);
    io.to(`event_${id}`).emit('participantJoined', { eventId: parseInt(id), user: userInfo.rows[0] });

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

    // Notify event chat about participant leaving
    io.to(`event_${id}`).emit('participantLeft', { eventId: parseInt(id), userId });

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
      SELECT m.id, m.text, m.created_at, u.id as sender_id, 
             CASE WHEN u.is_active = true THEN u.full_name ELSE 'Deleted' END as sender_name,
             CASE WHEN u.is_active = true THEN u.nickname ELSE 'deleted' END as sender_nickname,
             CASE WHEN u.is_active = true THEN u.photo_url ELSE NULL END as sender_photo
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
    const userResult = await pool.query('SELECT id, full_name, nickname, photo_url FROM users WHERE id = $1', [sender_id]);
    const sender = userResult.rows[0];

    res.status(201).json({
      id: message.id,
      text: message.text,
      created_at: message.created_at,
      sender_id: sender.id,
      sender_name: sender.full_name,
      sender_nickname: sender.nickname,
      sender_photo: sender.photo_url
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get personal chat list (distinct users communicated with)
app.get('/api/chats/personal', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Latest message per partner
    const result = await pool.query(`
      WITH RankedMessages AS (
        SELECT 
          m.id, m.text, m.created_at, m.sender_id, m.receiver_id,
          CASE 
            WHEN m.sender_id = $1 THEN m.receiver_id 
            ELSE m.sender_id 
          END as partner_id,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END 
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        WHERE ((m.sender_id = $1 AND m.receiver_id IS NOT NULL) OR (m.receiver_id = $1))
          AND NOT EXISTS (
            SELECT 1 FROM user_friends uf 
            WHERE uf.status = 'blocked' 
              AND (
                (uf.user_id = m.sender_id AND uf.friend_id = m.receiver_id) OR
                (uf.user_id = m.receiver_id AND uf.friend_id = m.sender_id)
              )
          )
      )
      SELECT 
        rm.id as message_id, 
        rm.text as last_message, 
        rm.created_at as last_message_time,
        rm.sender_id as last_sender_id,
        u.id as friend_id, 
        u.full_name as friend_name, 
        u.nickname as friend_nickname,
        u.photo_url as friend_photo,
        u.is_active as is_online
      FROM RankedMessages rm
      JOIN users u ON rm.partner_id = u.id
      WHERE rm.rn = 1
      ORDER BY rm.created_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching personal chats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get direct messages with a specific user
app.get('/api/messages/direct/:friendId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;
    
    const result = await pool.query(`
      SELECT m.id, m.text, m.created_at, m.receiver_id, u.id as sender_id, 
             CASE WHEN u.is_active = true THEN u.full_name ELSE 'Deleted' END as sender_name,
             CASE WHEN u.is_active = true THEN u.nickname ELSE 'deleted' END as sender_nickname,
             CASE WHEN u.is_active = true THEN u.photo_url ELSE NULL END as sender_photo
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
    `, [userId, friendId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete message
app.delete('/api/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check message info
    const msgResult = await pool.query('SELECT sender_id, event_id FROM messages WHERE id = $1', [id]);
    if (msgResult.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    
    const message = msgResult.rows[0];
    
    // Check if user is sender
    let canDelete = message.sender_id === userId;
    
    // If not sender, check if they are event creator or moderator
    if (!canDelete) {
      if (req.user.role === 'MODERATOR') {
        canDelete = true;
      } else if (message.event_id) {
        const eventResult = await pool.query('SELECT creator_id FROM events WHERE id = $1', [message.event_id]);
        if (eventResult.rows.length > 0 && eventResult.rows[0].creator_id === userId) {
          canDelete = true;
        }
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.query('DELETE FROM messages WHERE id = $1', [id]);

    // Notify chat participants about message deletion
    if (message.event_id) {
      io.to(`event_${message.event_id}`).emit('messageDeleted', { messageId: parseInt(id) });
    } else {
      // Direct message - notify both users
      const fullMsg = await pool.query('SELECT sender_id, receiver_id FROM messages WHERE id = $1', [id]);
      // Message already deleted, use data we fetched earlier
      const minId = Math.min(message.sender_id, userId);
      const maxId = Math.max(message.sender_id, userId);
      io.to(`direct_${minId}_${maxId}`).emit('messageDeleted', { messageId: parseInt(id) });
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
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
