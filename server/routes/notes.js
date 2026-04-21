const router = require('express').Router();
const auth   = require('../middleware/auth');
const { Note } = require('../models/Learning');
const { gemini } = require('../services/ai');

// GET /api/notes
router.get('/', auth, async (req, res) => {
  const notes = await Note.find({ user: req.user._id }).sort({ isPinned: -1, updatedAt: -1 });
  res.json(notes);
});

// POST /api/notes
router.post('/', auth, async (req, res) => {
  const { title, content, topic_id } = req.body;
  if (!title) return res.status(400).json({ message: 'Title required' });
  const note = await Note.create({ user: req.user._id, title, content: content || '', topic: topic_id });
  res.status(201).json(note);
});

// PUT /api/notes/:id
router.put('/:id', auth, async (req, res) => {
  const { title, content, is_pinned } = req.body;
  const update = {};
  if (title    !== undefined) update.title    = title;
  if (content  !== undefined) update.content  = content;
  if (is_pinned!== undefined) update.isPinned = is_pinned;
  const note = await Note.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, update, { new: true });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  res.json(note);
});

// POST /api/notes/:id/enhance — AI enhance note content
router.post('/:id/enhance', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const prompt = `You are an expert educational content writer. Enhance and expand the following notes with:
- Clearer structure and headers
- Additional context and examples
- Key terms highlighted in bold
- A summary section at the end

Original Notes:
${note.content}

Return enhanced markdown notes:`;

    const enhanced = await gemini(prompt, req.user.geminiApiKey);
    note.content   = enhanced;
    await note.save();
    res.json(note);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/notes/:id
router.delete('/:id', auth, async (req, res) => {
  await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
