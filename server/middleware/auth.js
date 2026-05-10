import { verifyToken } from '../config/jwt.js';
import pool from '../db/config.js';

export const authenticateToken = async (req, res, next) => {
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

export const checkEventAccess = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const accessCheck = await pool.query(`
      SELECT 1 FROM events e
      LEFT JOIN event_participants ep ON ep.event_id = e.id AND ep.user_id = $2
      WHERE e.id = $1 AND (e.creator_id = $2 OR ep.user_id IS NOT NULL OR $3 = 'MODERATOR')
    `, [id, userId, req.user.role]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Ви повинні бути учасником заходу для цієї дії' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
