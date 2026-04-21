const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const http     = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// ── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Routes ───────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/topics',       require('./routes/topics'));
app.use('/api/documents',    require('./routes/documents'));
app.use('/api/chat',         require('./routes/chat'));
app.use('/api/quiz',         require('./routes/quiz'));
app.use('/api/progress',     require('./routes/progress'));
app.use('/api/flashcards',   require('./routes/flashcards'));
app.use('/api/search',       require('./routes/search'));
app.use('/api/notes',        require('./routes/notes'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/classrooms',   require('./routes/classrooms'));
app.use('/api/lectures',     require('./routes/lectures'));
app.use('/api/analytics',    require('./routes/analytics'));

// ── Health ───────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: '✅ NeuroBase AI API (MERN) is running!' }));
app.get('/health', (req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

// ── Socket.io — Real-time Live Class ─────────────────────
require('./socket/liveClass')(io);

// ── Database Connection ───────────────────────────────────
const PORT = process.env.PORT || 8000;

async function connectDB() {
  // Try Atlas/provided URI first
  if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('YOUR_CLUSTER')) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB Atlas connected');
      return;
    } catch (err) {
      console.log('⚠️  Atlas connection failed, falling back to in-memory MongoDB...');
    }
  }

  // Fallback: in-memory MongoDB (works offline, no setup needed)
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri    = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ In-memory MongoDB started (data resets on server restart)');
    console.log('💡 To persist data, set MONGO_URI in server/.env to a MongoDB Atlas connection string');
  } catch (err) {
    console.error('❌ All DB options failed:', err.message);
  }
}

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 NeuroBase MERN server running → http://localhost:${PORT}`);
  });
});

module.exports = app;
