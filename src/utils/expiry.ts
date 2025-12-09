export function parseExpiry(expiry: string): Date {
  const now = new Date();

  switch (expiry) {
    case '1H':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '1D':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case '1M':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    case '1Y':
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    default:
      throw new Error('Invalid expiry format. Use 1H, 1D, 1M, or 1Y');
  }
}

export function isExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}
