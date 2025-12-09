import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    'http://localhost:3000/auth/google/callback',
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY!,
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY!,
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://localhost:5432/wallet_service',
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbHost: process.env.DB_HOST,
  dbPort: process.env.DB_PORT,
  dbName: process.env.DB_NAME,
};
