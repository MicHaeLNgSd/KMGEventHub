import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'MikeBlAbLaCoDe';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export { JWT_SECRET, JWT_EXPIRES_IN };