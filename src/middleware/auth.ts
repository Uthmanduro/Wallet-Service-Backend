import { Response, NextFunction } from 'express';
import { AuthRequest, User } from '../types';
import { verifyJWT } from '../utils/jwt';
import { pool } from '../database';
import { hashApiKey } from '../utils/crypto';
import { isExpired } from '../utils/expiry';

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // JWT Authentication
      const token = authHeader.substring(7);
      const decoded = verifyJWT(token);

      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
        decoded.userId,
      ]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = userResult.rows[0];

      // Get wallet
      const walletResult = await pool.query(
        'SELECT * FROM wallets WHERE user_id = $1',
        [(req.user as User).id]
      );

      if (walletResult.rows.length > 0) {
        req.wallet = walletResult.rows[0];
      }

      return next();
    } else if (apiKey) {
      // API Key Authentication
      const keyHash = hashApiKey(apiKey);

      const keyResult = await pool.query(
        'SELECT * FROM api_keys WHERE key_hash = $1 AND revoked = FALSE',
        [keyHash]
      );

      if (keyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const apiKeyRecord = keyResult.rows[0];

      if (isExpired(apiKeyRecord.expires_at)) {
        return res.status(401).json({ error: 'API key expired' });
      }

      // Store permissions in request
      (req as any).permissions = JSON.parse(apiKeyRecord.permissions);

      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
        apiKeyRecord.user_id,
      ]);

      req.user = userResult.rows[0];

      const walletResult = await pool.query(
        'SELECT * FROM wallets WHERE user_id = $1',
        [req.user!.id]
      );

      if (walletResult.rows.length > 0) {
        req.wallet = walletResult.rows[0];
      }

      return next();
    }

    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const permissions = (req as any).permissions;

    // JWT users have all permissions
    if (!permissions) {
      return next();
    }

    // Check API key permissions
    if (!permissions.includes(permission)) {
      return res
        .status(403)
        .json({ error: `Missing permission: ${permission}` });
    }

    next();
  };
}
