const router    = require('express').Router();
const auth      = require('../middleware/auth');
const { Flashcard } = require('../models/Learning');
const Topic     = require('../models/Topic');
const { gemini } = require('../services/ai');

// GET /api/flashcards
router.get('/', auth, async (req, res) => {
  const cards = await Flashcard.find({ user: req.user._id }).sort({ nextReview: 1 });
  res.json(cards);
});

// GET /api/flashcards/due — cards due for review (spaced repetition)
router.get('/due', auth, async (req, res) => {
  const now  = new Date();
  const cards = await Flashcard.find({ user: req.user._id, nextReview: { $lte: now } })
    .sort({ nextReview: 1 }).limit(20);
  res.json(cards);
});

// POST /api/flashcards — create single
router.post('/', auth, async (req, res) => {
  const { front, back, topic_id, difficulty } = req.body;
  if (!front || !back) return res.status(400).json({ message: 'Front and back required' });
  const card = await Flashcard.create({ user: req.user._id, front, back, topic: topic_id, difficulty: difficulty || 'medium' });
  res.status(201).json(card);
});

// POST /api/flashcards/generate — AI generate from topic
router.post('/generate', auth, async (req, res) => {
  try {
    const { topic_id } = req.body;
    const topic = await Topic.findOne({ _id: topic_id, user: req.user._id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const prompt = `Generate 8 flashcards for the topic "${topic.title}". Cover key definitions, formulas, and concepts.
Return ONLY a JSON array (no markdown):
[{"front":"Question or term","back":"Answer or definition"}]`;

    const raw   = await gemini(prompt, req.user.geminiApiKey);
    const clean = raw.replace(/```json|```/g, '').trim();
    const cards = JSON.parse(clean);

    const created = await Flashcard.insertMany(
      cards.map(c => ({ user: req.user._id, topic: topic_id, front: c.front, back: c.back }))
    );
    res.json(created);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/flashcards/:id/review — SM-2 spaced repetition update
router.post('/:id/review', auth, async (req, res) => {
  try {
    const { quality } = req.body; // 0-5 (0=forgot, 5=perfect)
    const card = await Flashcard.findOne({ _id: req.params.id, user: req.user._id });
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // SM-2 algorithm
    let { easeFactor, interval, repetitions } = card;
    if (quality < 3) {
      repetitions = 0; interval = 1;
    } else {
      if (repetitions === 0)      interval = 1;
      else if (repetitions === 1) interval = 6;
      else                         interval = Math.round(interval * easeFactor);
      repetitions++;
    }
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    const updated = await Flashcard.findByIdAndUpdate(card._id,
      { easeFactor, interval, repetitions, nextReview, difficulty: quality >= 4 ? 'easy' : quality >= 2 ? 'medium' : 'hard' },
      { new: true }
    );
    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/flashcards/:id
router.delete('/:id', auth, async (req, res) => {
  await Flashcard.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
