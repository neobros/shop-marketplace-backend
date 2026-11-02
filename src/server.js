// Local / VPS entry point. On Vercel the app is served by api/index.js instead.
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT} (MongoDB connected)`)))
  .catch((err) => {
    console.error('ERROR: Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
