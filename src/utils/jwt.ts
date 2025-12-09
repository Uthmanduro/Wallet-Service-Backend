import jwt from 'jsonwebtoken';
import { config } from '../config';

export function generateJWT(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyJWT(token: string): { userId: string; email: string } {
  return jwt.verify(token, config.jwtSecret) as {
    userId: string;
    email: string;
  };
}
