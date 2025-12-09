import { Router } from 'express';
import axios from 'axios';
import { config } from '../config';
import { pool } from '../database';
import { generateId, generateWalletNumber } from '../utils/crypto';
import { generateJWT } from '../utils/jwt';

export const authRouter = Router();

authRouter.get('/google', (req, res) => {
  const googleAuthUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${config.googleClientId}&` +
    `redirect_uri=${encodeURIComponent(config.googleRedirectUri)}&` +
    `response_type=code&` +
    `scope=email profile`;

  res.redirect(googleAuthUrl);
});

authRouter.get('/google/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: 'authorization_code',
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const { email, name, id: googleId } = userInfoResponse.data;

    // Check if user exists
    let userResult = await pool.query('SELECT * FROM users WHERE email = $1', [
      email,
    ]);

    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const userId = generateId();
      await pool.query(
        'INSERT INTO users (id, email, name) VALUES ($1, $2, $3)',
        [userId, email, name]
      );

      // Create wallet for user
      const walletId = generateId();
      const walletNumber = generateWalletNumber();
      await pool.query(
        'INSERT INTO wallets (id, user_id, wallet_number) VALUES ($1, $2, $3)',
        [walletId, userId, walletNumber]
      );

      user = { id: userId, email, name };
    } else {
      user = userResult.rows[0];
    }

    // Generate JWT
    const token = generateJWT(user.id, user.email);

    res.json({ token });
  } catch (error: any) {
    console.error('Google auth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});
