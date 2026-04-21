const router   = require('express').Router();
const auth     = require('../middleware/auth');
const Document = require('../models/Document');
const { ChatMessage } = require('../models/Learning');
const { gemini, chunkText, retrieveRelevantChunks } = require('../services/ai');

// GET /api/chat/history
router.get('/history', auth, async (req, res) => {
  const messages = await ChatMessage.find({ user: req.user._id }).sort({ createdAt: 1 }).limit(100);
  res.json(messages);
});

// POST /api/chat — send message with RAG
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'Message required' });

    // Save user message
    await ChatMessage.create({ user: req.user._id, role: 'user', content: message });

    // RAG: pull all chunks from user's documents
    const docs = await Document.find({ user: req.user._id });
    const allChunks = docs.flatMap(d => d.chunks || []);
    const relevant  = retrieveRelevantChunks(message, allChunks, 5);

    const context = relevant.length > 0
      ? `RELEVANT KNOWLEDGE FROM YOUR SECOND BRAIN:\n${relevant.join('\n\n---\n\n')}\n\n`
      : '';

    const prompt = `You are NeuroBase AI Tutor — an intelligent, adaptive, and friendly educational assistant.
${context}
USER QUESTION: ${message}

Provide a clear, structured, and helpful answer. Use markdown formatting where appropriate.`;

    const answer = await gemini(prompt, req.user.geminiApiKey);

    // Save assistant message
    const assistantMsg = await ChatMessage.create({ user: req.user._id, role: 'assistant', content: answer });
    res.json({ id: assistantMsg._id, role: 'assistant', content: answer });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/chat/history
router.delete('/history', auth, async (req, res) => {
  await ChatMessage.deleteMany({ user: req.user._id });
  res.json({ message: 'Chat history cleared' });
});

module.exports = router;
