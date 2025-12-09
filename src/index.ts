import express from 'express';
import 'express-async-errors';
import { config } from './config';
import { authRouter } from './routes/auth';
import { keysRouter } from './routes/keys';
import { walletRouter } from './routes/wallet';
import { errorHandler } from './middleware/errorHandler';
import { initDatabase } from './database';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRouter);
app.use('/keys', keysRouter);
app.use('/wallet', walletRouter);

// Error handling
app.use(errorHandler);

// Initialize database and start server
initDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
});

export default app;
