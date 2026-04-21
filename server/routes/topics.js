const router = require('express').Router();
const auth   = require('../middleware/auth');
const Topic  = require('../models/Topic');
const { gemini } = require('../services/ai');

// GET /api/topics
router.get('/', auth, async (req, res) => {
  const topics = await Topic.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(topics);
});

// POST /api/topics — create topic and AI-generate subtopics
router.post('/', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: 'Title required' });

    const topic = await Topic.create({ user: req.user._id, title });

    // AI generate subtopics
    const prompt = `You are an expert educator. For the topic "${title}", generate 6-8 structured subtopics for a complete learning curriculum.
Return ONLY a JSON array of objects in this exact format (no markdown, no extra text):
[{"title": "Subtopic Name", "content": "2-3 sentence explanation of what this covers"}]`;

    const raw = await gemini(prompt, req.user.geminiApiKey);
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const subtopics = JSON.parse(cleaned);
      topic.subtopics = subtopics.map(s => ({ title: s.title, description: s.content || '', content: '', isGenerated: true }));
      await topic.save();
    } catch (e) { /* subtopics generation failed, topic still saved */ }

    res.status(201).json(topic);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/topics/:id
router.get('/:id', auth, async (req, res) => {
  const topic = await Topic.findOne({ _id: req.params.id, user: req.user._id });
  if (!topic) return res.status(404).json({ message: 'Topic not found' });
  res.json(topic);
});

// DELETE /api/topics/:id
router.delete('/:id', auth, async (req, res) => {
  await Topic.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Deleted' });
});

// POST /api/topics/:id/generate-notes — AI detailed notes for a subtopic
router.post('/:id/generate-notes', auth, async (req, res) => {
  try {
    const { subtopicTitle } = req.body;
    const topic = await Topic.findOne({ _id: req.params.id, user: req.user._id });
    if (!topic) return res.status(404).json({ message: 'Not found' });

    const prompt = `You are an expert tutor and educational content writer. Write COMPREHENSIVE, DETAILED markdown notes for the subtopic "${subtopicTitle}" under the topic "${topic.title}".

Your notes must be AT LEAST 800 words and include ALL of the following:

## Structure Required:
1. **Introduction** — What is this concept and why is it important?
2. **Core Concepts** — Detailed explanations with clear definitions
3. **How It Works** — Step-by-step breakdown of mechanisms/processes  
4. **Key Formulas/Rules** — Any relevant formulas, theorems, or rules (use code blocks)
5. **Examples** — At least 2-3 worked examples with solutions
6. **Visual Representation** — ASCII diagrams or tables where applicable
7. **Real-World Applications** — Practical uses and industry relevance
8. **Common Mistakes** — Pitfalls students should avoid
9. **Summary** — Quick recap of key points
10. **Practice Questions** — 3 questions for self-assessment

Use rich markdown: ## headers, **bold** key terms, \`code blocks\`, > blockquotes for important notes, bullet points, and numbered lists.
Make notes engaging, thorough, and exam-ready.`;

    const notes = await gemini(prompt, req.user.geminiApiKey);
    const sub = topic.subtopics.find(s => s.title === subtopicTitle);
    if (sub) { sub.content = notes; await topic.save(); }
    res.json({ notes });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
