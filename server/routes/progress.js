const router       = require('express').Router();
const auth         = require('../middleware/auth');
const Topic        = require('../models/Topic');
const Document     = require('../models/Document');
const { QuizAttempt, KnowledgeGap } = require('../models/Quiz');
const { gemini }   = require('../services/ai');

// GET /api/progress/dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const uid = req.user._id;
    const [topics, docs, quizAttempts, gaps] = await Promise.all([
      Topic.find({ user: uid }),
      Document.find({ user: uid }, '_id'),
      QuizAttempt.find({ user: uid }),
      KnowledgeGap.find({ user: uid }),
    ]);

    const avgScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((s, a) => s + (a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0), 0) / quizAttempts.length)
      : 0;

    const recentTopics = topics
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
      .map(t => ({ id: t._id, title: t.title, status: t.status }));

    // AI insights
    const weakTopics = topics.filter(t => t.status === 'Weak').map(t => t.title).slice(0, 3);
    let insights = [];
    if (weakTopics.length > 0) {
      const prompt = `A student is struggling with: ${weakTopics.join(', ')}. 
Give 3 short, encouraging study tips (one sentence each). Return as JSON array: ["tip1","tip2","tip3"]`;
      try {
        const raw = await gemini(prompt, req.user.geminiApiKey);
        insights  = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch (e) {
        insights = ['Review your weak topics regularly', 'Try explaining concepts in your own words', 'Use the quiz system to identify gaps'];
      }
    } else {
      insights = ["Great work! Keep exploring new topics.", "Try generating flashcards from your strongest topics.", "Upload more documents to expand your Second Brain."];
    }

    res.json({
      stats: {
        total_topics: topics.length, total_documents: docs.length,
        total_quizzes: quizAttempts.length, avg_score: avgScore,
        weak_topics: gaps.length,
      },
      recent_topics: recentTopics,
      insights,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
