const router  = require('express').Router();
const auth    = require('../middleware/auth');
const { Classroom, Lecture } = require('../models/Classroom');
const { QuizAttempt, KnowledgeGap } = require('../models/Quiz');

// GET /api/analytics/classroom/:id — teacher dashboard
router.get('/classroom/:id', auth, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate('teacher', 'email');
    if (!classroom) return res.status(404).json({ message: 'Not found' });
    if (classroom.teacher._id.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Not authorized' });

    const lectures = await Lecture.find({ classroom: req.params.id });

    let totalChat = 0, totalHands = 0;
    const topicFreq  = {};
    const lectureStats = [];

    for (const lec of lectures) {
      const chatCount = lec.chatMessages.filter(m => !m.isAiResponse).length;
      const handCount = lec.raisedHands.length;
      const attempts  = await QuizAttempt.find({ lecture: lec._id });
      const avgScore  = attempts.length > 0
        ? +(attempts.reduce((s, a) => s + (a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0), 0) / attempts.length).toFixed(1)
        : 0;

      lec.detectedTopics.forEach(t => { topicFreq[t] = (topicFreq[t] || 0) + 1; });
      totalChat  += chatCount;
      totalHands += handCount;

      lectureStats.push({
        id: lec._id, title: lec.title,
        date: lec.createdAt, chat_messages: chatCount,
        hand_raises: handCount, quiz_attempts: attempts.length,
        avg_quiz_score: avgScore, topics: lec.detectedTopics
      });
    }

    const hotTopics = Object.entries(topicFreq)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Most active students (by chat messages)
    const activity = {};
    for (const lec of lectures) {
      lec.chatMessages.filter(m => !m.isAiResponse).forEach(m => {
        const uid = m.user.toString();
        activity[uid] = (activity[uid] || 0) + 1;
      });
    }
    const User = require('../models/User');
    const activeStudents = await Promise.all(
      Object.entries(activity).sort((a, b) => b[1] - a[1]).slice(0, 10).map(async ([uid, count]) => {
        const u = await User.findById(uid).select('email');
        return { email: u?.email || 'Unknown', messages: count };
      })
    );

    res.json({
      classroom_name: classroom.name,
      student_count: classroom.enrollments.length,
      total_lectures: lectures.length,
      live_now: lectures.filter(l => l.isLive).length,
      total_chat_messages: totalChat, total_hand_raises: totalHands,
      hot_topics: hotTopics, active_students: activeStudents,
      lecture_stats: lectureStats
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/student — personal analytics + reminders
router.get('/student', auth, async (req, res) => {
  try {
    const uid = req.user._id;
    const classrooms   = await Classroom.find({ enrollments: uid });
    const classroomIds = classrooms.map(c => c._id);
    const lectures     = await Lecture.find({ classroom: { $in: classroomIds }, isLive: false });
    const attempts     = await QuizAttempt.find({ user: uid, lecture: { $ne: null } });
    const gaps         = await KnowledgeGap.find({ user: uid, source: 'lecture' });

    const attended   = new Set(attempts.map(a => a.lecture?.toString()));
    const avgScore   = attempts.length > 0
      ? +(attempts.reduce((s, a) => s + (a.totalQuestions > 0 ? (a.score / a.totalQuestions) * 100 : 0), 0) / attempts.length).toFixed(1)
      : 0;

    const weakTopics = [...new Set(gaps.map(g => g.suggestedTopic).filter(Boolean))];

    // Smart Reminders
    const reminders = [];
    for (const lec of lectures.slice(-5)) {
      if (!attended.has(lec._id.toString())) {
        reminders.push(`📝 You missed "${lec.title}" — review the notes!`);
      } else {
        const att = attempts.find(a => a.lecture?.toString() === lec._id.toString());
        if (att && att.totalQuestions > 0) {
          const pct = (att.score / att.totalQuestions) * 100;
          if (pct < 70) reminders.push(`🔄 Revise "${lec.title}" — you scored ${pct.toFixed(0)}%`);
        }
      }
    }
    if (reminders.length === 0) reminders.push('✅ You\'re all caught up! Great work.');

    res.json({
      total_lectures_available: lectures.length,
      lectures_attended: attended.size,
      lectures_missed: lectures.length - attended.size,
      avg_quiz_score: avgScore,
      total_quiz_attempts: attempts.length,
      weak_topics: weakTopics,
      reminders
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
