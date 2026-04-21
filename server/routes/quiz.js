const router = require('express').Router();
const auth   = require('../middleware/auth');
const Topic  = require('../models/Topic');
const { QuizAttempt, KnowledgeGap } = require('../models/Quiz');
const { gemini } = require('../services/ai');

// POST /api/quiz/generate
router.post('/generate', auth, async (req, res) => {
  try {
    const { topic_id } = req.body;
    const topic = await Topic.findOne({ _id: topic_id, user: req.user._id });
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const difficulty = topic.status === 'Weak' ? 'challenging' : topic.status === 'Strong' ? 'advanced' : 'moderate';
    const subtopicsText = topic.subtopics.map(s => `- ${s.title}: ${s.content}`).join('\n');

    const prompt = `Generate exactly 5 ${difficulty} multiple choice questions to test understanding of "${topic.title}".
Context:
${subtopicsText}

Return ONLY a JSON array (no markdown):
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"..."}]`;

    const raw   = await gemini(prompt, req.user.geminiApiKey);
    const clean = raw.replace(/```json|```/g, '').trim();
    const quiz  = JSON.parse(clean);
    res.json({ topic_id, quiz });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/quiz/submit
router.post('/submit', auth, async (req, res) => {
  try {
    const { topic_id, score, total_questions } = req.body;
    await QuizAttempt.create({ user: req.user._id, topic: topic_id, score, totalQuestions: total_questions });

    const pct = total_questions > 0 ? (score / total_questions) * 100 : 0;
    const status = pct >= 80 ? 'Strong' : pct >= 50 ? 'Medium' : 'Weak';
    await Topic.updateOne({ _id: topic_id }, { status });

    if (pct < 60) {
      const topic = await Topic.findById(topic_id);
      await KnowledgeGap.create({
        user: req.user._id,
        description: `Low quiz score (${pct.toFixed(0)}%) on "${topic?.title}"`,
        suggestedTopic: topic?.title || '',
        source: 'quiz'
      });
    }
    res.json({ message: 'Quiz submitted', new_status: status });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/quiz/gaps
router.get('/gaps', auth, async (req, res) => {
  const gaps = await KnowledgeGap.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json(gaps);
});

module.exports = router;
