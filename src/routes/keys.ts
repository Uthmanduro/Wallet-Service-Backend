import { Router } from 'express';
import { AuthRequest } from '../types';
import { authenticate } from '../middleware/auth';
import { pool } from '../database';
import { generateId, generateApiKey, hashApiKey } from '../utils/crypto';
import { parseExpiry, isExpired } from '../utils/expiry';

export const keysRouter = Router();

keysRouter.post('/create', authenticate, async (req: AuthRequest, res) => {
  const { name, permissions, expiry } = req.body;

  if (!name || !permissions || !expiry) {
    return res
      .status(400)
      .json({ error: 'name, permissions, and expiry are required' });
  }

  if (!['1H', '1D', '1M', '1Y'].includes(expiry)) {
    return res
      .status(400)
      .json({ error: 'Invalid expiry. Use 1H, 1D, 1M, or 1Y' });
  }

  const validPermissions = ['deposit', 'transfer', 'read'];
  for (const perm of permissions) {
    if (!validPermissions.includes(perm)) {
      return res.status(400).json({ error: `Invalid permission: ${perm}` });
    }
  }

  // Check active keys count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()',
    [req.user!.id]
  );

  const activeCount = parseInt(countResult.rows[0].count);
  if (activeCount >= 5) {
    return res.status(400).json({ error: 'Maximum 5 active API keys allowed' });
  }

  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const expiresAt = parseExpiry(expiry);
  const keyId = generateId();

  await pool.query(
    'INSERT INTO api_keys (id, user_id, key_hash, name, permissions, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [keyId, req.user!.id, keyHash, name, JSON.stringify(permissions), expiresAt]
  );

  res.json({
    api_key: apiKey,
    expires_at: expiresAt.toISOString(),
  });
});

keysRouter.post('/rollover', authenticate, async (req: AuthRequest, res) => {
  const { expired_key_id, expiry } = req.body;

  if (!expired_key_id || !expiry) {
    return res
      .status(400)
      .json({ error: 'expired_key_id and expiry are required' });
  }

  if (!['1H', '1D', '1M', '1Y'].includes(expiry)) {
    return res
      .status(400)
      .json({ error: 'Invalid expiry. Use 1H, 1D, 1M, or 1Y' });
  }

  // Get expired key
  const keyResult = await pool.query(
    'SELECT * FROM api_keys WHERE id = $1 AND user_id = $2',
    [expired_key_id, req.user!.id]
  );

  if (keyResult.rows.length === 0) {
    return res.status(404).json({ error: 'API key not found' });
  }

  const oldKey = keyResult.rows[0];

  if (!isExpired(oldKey.expires_at)) {
    return res.status(400).json({ error: 'API key is not expired' });
  }

  // Check active keys count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()',
    [req.user!.id]
  );

  const activeCount = parseInt(countResult.rows[0].count);
  if (activeCount >= 5) {
    return res.status(400).json({ error: 'Maximum 5 active API keys allowed' });
  }

  // Create new key with same permissions
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const expiresAt = parseExpiry(expiry);
  const keyId = generateId();

  await pool.query(
    'INSERT INTO api_keys (id, user_id, key_hash, name, permissions, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [keyId, req.user!.id, keyHash, oldKey.name, oldKey.permissions, expiresAt]
  );

  res.json({
    api_key: apiKey,
    expires_at: expiresAt.toISOString(),
  });
});
