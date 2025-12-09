import crypto from 'crypto';

export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function generateApiKey(): string {
  return 'sk_live_' + crypto.randomBytes(32).toString('hex');
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateWalletNumber(): string {
  return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
}

export function verifyPaystackSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac('sha512', secret)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
