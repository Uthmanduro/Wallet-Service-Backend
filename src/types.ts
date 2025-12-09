import express from 'express';

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at: Date;
}

export interface Wallet {
  id: string;
  user_id: string;
  wallet_number: string;
  balance: number;
  created_at: Date;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'deposit' | 'transfer';
  amount: number;
  status: 'pending' | 'success' | 'failed';
  reference?: string;
  recipient_wallet_id?: string;
  metadata?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface AuthRequest extends express.Request {
  user?: User;
  wallet?: Wallet;
}
