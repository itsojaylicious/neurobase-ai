/**
 * Vercel Serverless Entry Point
 * This file lives at /api/index.js (repo root level).
 * Vercel routes /api/* here as a Node.js serverless function.
 *
 * NOTE: Socket.IO real-time features are NOT available in serverless.
 * For production real-time you would need a separate stateful service (e.g. Railway/Render).
 */
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',       require('../server/routes/auth'));
app.use('/api/topics',     require('../server/routes/topics'));
app.use('/api/documents',  require('../server/routes/documents'));
app.use('/api/chat',       require('../server/routes/chat'));
app.use('/api/quiz',       require('../server/routes/quiz'));
app.use('/api/progress',   require('../server/routes/progress'));
app.use('/api/flashcards', require('../server/routes/flashcards'));
app.use('/api/search',     require('../server/routes/search'));
app.use('/api/notes',      require('../server/routes/notes'));
app.use('/api/settings',   require('../server/routes/settings'));
app.use('/api/classrooms', require('../server/routes/classrooms'));
app.use('/api/lectures',   require('../server/routes/lectures'));
app.use('/api/analytics',  require('../server/routes/analytics'));

// ── Health ─────────────────────────────────────────────────
app.get('/api', (req, res) =>
  res.json({ message: '✅ NeuroBase AI API is running on Vercel!' })
);

// ── DB Connection (cached across warm invocations) ─────────
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI environment variable is not set.');
  await mongoose.connect(uri);
  isConnected = true;
  console.log('✅ MongoDB connected');
}

// Wrap every request in a DB-connection guard
const handler = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    return res.status(503).json({ message: 'Database unavailable: ' + err.message });
  }
  return app(req, res);
};

module.exports = handler;
