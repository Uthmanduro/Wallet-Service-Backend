import { Router } from 'express';
import axios from 'axios';
import { AuthRequest } from '../types';
import { authenticate, requirePermission } from '../middleware/auth';
import { pool } from '../database';
import { config } from '../config';
import { generateId } from '../utils/crypto';
import { verifyPaystackSignature } from '../utils/crypto';

export const walletRouter = Router();

walletRouter.post(
  '/deposit',
  authenticate,
  requirePermission('deposit'),
  async (req: AuthRequest, res) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!req.wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    const reference = `dep_${generateId()}`;

    try {
      // Initialize Paystack transaction
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: req.user!.email,
          amount: amount * 100, // Paystack uses kobo
          reference,
          callback_url: `${req.protocol}://${req.get(
            'host'
          )}/wallet/deposit/${reference}/status`,
        },
        {
          headers: {
            Authorization: `Bearer ${config.paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Create pending transaction
      await pool.query(
        'INSERT INTO transactions (id, wallet_id, type, amount, status, reference) VALUES ($1, $2, $3, $4, $5, $6)',
        [generateId(), req.wallet.id, 'deposit', amount, 'pending', reference]
      );

      res.json({
        reference,
        authorization_url: response.data.data.authorization_url,
      });
    } catch (error: any) {
      console.error('Paystack error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to initialize payment' });
    }
  }
);

walletRouter.post('/paystack/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'] as string;

  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);

  if (!verifyPaystackSignature(payload, signature, config.paystackSecretKey)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  console.log('PAYSTACK EVENT:', event);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reference = data.reference;

    // Fetch transaction if reference exists
    const txResult = await client.query(
      'SELECT * FROM transactions WHERE reference = $1',
      [reference]
    );

    let transaction = txResult.rows[0] || null;

    /* -------------------------------
       EVENT: charge.success
    -------------------------------- */
    if (event === 'charge.success') {
      if (!transaction) {
        await client.query('ROLLBACK');
        return res.json({ status: true });
      }

      if (transaction.status === 'success') {
        await client.query('ROLLBACK');
        return res.json({ status: true });
      }

      await client.query(
        'UPDATE transactions SET status=$1, updated_at=NOW() WHERE id=$2',
        ['success', transaction.id]
      );

      const amountInNaira = data.amount / 100;
      await client.query(
        'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
        [amountInNaira, transaction.wallet_id]
      );

      await client.query('COMMIT');
      return res.json({ status: true });
    }

    /* -------------------------------
       EVENT: charge.failed
    -------------------------------- */
    if (event === 'charge.failed') {
      if (transaction && transaction.status !== 'success') {
        await client.query(
          'UPDATE transactions SET status=$1, updated_at=NOW() WHERE id=$2',
          ['failed', transaction.id]
        );
      }

      await client.query('COMMIT');
      return res.json({ status: true });
    }

    /* -------------------------------
       EVENT: charge.abandoned
    -------------------------------- */
    if (event === 'charge.abandoned') {
      if (transaction && transaction.status !== 'success') {
        await client.query(
          'UPDATE transactions SET status=$1, updated_at=NOW() WHERE id=$2',
          ['abandoned', transaction.id]
        );
      }

      await client.query('COMMIT');
      return res.json({ status: true });
    }

    /* -------------------------------
       Any other unhandled event
    -------------------------------- */
    console.log('Unhandled Paystack event:', event);
    await client.query('COMMIT');
    return res.json({ status: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Webhook error:', err);
    return res.json({ status: true }); // Paystack requires 200-series response
  } finally {
    client.release();
  }
});

walletRouter.get(
  '/deposit/:reference/status',
  // authenticate,
  async (req: AuthRequest, res) => {
    const { reference } = req.params;

    const txResult = await pool.query(
      'SELECT * FROM transactions WHERE reference = $1',
      [reference]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const transaction = txResult.rows[0];

    res.json({
      reference: transaction.reference,
      status: transaction.status,
      amount: parseFloat(transaction.amount),
    });
  }
);

walletRouter.get(
  '/balance',
  authenticate,
  requirePermission('read'),
  async (req: AuthRequest, res) => {
    if (!req.wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    res.json({
      balance: Number(req.wallet.balance),
    });
  }
);

walletRouter.post(
  '/transfer',
  authenticate,
  requirePermission('transfer'),
  async (req: AuthRequest, res) => {
    const { wallet_number, amount } = req.body;

    if (!wallet_number || !amount || amount <= 0) {
      return res
        .status(400)
        .json({ error: 'wallet_number and valid amount are required' });
    }

    if (!req.wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    // Check balance
    if (Number(req.wallet.balance) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Find recipient wallet
    const recipientResult = await pool.query(
      'SELECT * FROM wallets WHERE wallet_number = $1',
      [wallet_number]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient wallet not found' });
    }

    const recipientWallet = recipientResult.rows[0];

    if (recipientWallet.id === req.wallet.id) {
      return res.status(400).json({ error: 'Cannot transfer to own wallet' });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Deduct from sender
      await client.query(
        'UPDATE wallets SET balance = balance - $1 WHERE id = $2',
        [amount, req.wallet.id]
      );

      // Add to recipient
      await client.query(
        'UPDATE wallets SET balance = balance + $1 WHERE id = $2',
        [amount, recipientWallet.id]
      );

      // Record transaction for sender
      await client.query(
        'INSERT INTO transactions (id, wallet_id, type, amount, status, recipient_wallet_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          generateId(),
          req.wallet.id,
          'transfer',
          -amount,
          'success',
          recipientWallet.id,
        ]
      );

      // Record transaction for recipient
      await client.query(
        'INSERT INTO transactions (id, wallet_id, type, amount, status) VALUES ($1, $2, $3, $4, $5)',
        [generateId(), recipientWallet.id, 'transfer', amount, 'success']
      );

      await client.query('COMMIT');

      res.json({
        status: 'success',
        message: 'Transfer completed',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
);

walletRouter.get(
  '/transactions',
  authenticate,
  requirePermission('read'),
  async (req: AuthRequest, res) => {
    if (!req.wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    const txResult = await pool.query(
      'SELECT type, amount, status, created_at FROM transactions WHERE wallet_id = $1 ORDER BY created_at DESC',
      [req.wallet.id]
    );

    const transactions = txResult.rows.map((tx) => ({
      type: tx.type,
      amount: parseFloat(tx.amount),
      status: tx.status,
    }));

    res.json(transactions);
  }
);
