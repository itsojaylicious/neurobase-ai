const router   = require('express').Router();
const auth     = require('../middleware/auth');
const { Classroom, Lecture } = require('../models/Classroom');
const { Note }  = require('../models/Learning');
const Document  = require('../models/Document');
const { QuizAttempt, KnowledgeGap } = require('../models/Quiz');
const Topic     = require('../models/Topic');
const { gemini, chunkText } = require('../services/ai');
const { v4: uuidv4 }        = require('uuid');

// POST /api/lectures — start lecture (teacher)
router.post('/', auth, async (req, res) => {
  try {
    const { classroom_id, title } = req.body;
    const room = await Classroom.findById(classroom_id);
    if (!room) return res.status(404).json({ message: 'Classroom not found' });
    if (room.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only teacher can start a lecture' });

    const jitsiRoom = `neurobase-${classroom_id}-${uuidv4().slice(0, 8)}`;
    const lecture = await Lecture.create({
      classroom: classroom_id, teacher: req.user._id,
      title, isLive: true, jitsiRoom
    });
    res.status(201).json(lecture);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/lectures/:id/transcript — append transcript chunk
router.put('/:id/transcript', auth, async (req, res) => {
  try {
    const { text_chunk } = req.body;
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });
    if (lecture.teacher.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only the host can update transcript' });
    if (!lecture.isLive) return res.status(400).json({ message: 'Lecture already ended' });

    lecture.transcript = (lecture.transcript + ' ' + text_chunk).trim();
    await lecture.save();
    res.json({ status: 'ok', length: lecture.transcript.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/lectures/:id/live — students poll for transcript
router.get('/:id/live', auth, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id).select('transcript isLive summary detectedTopics jitsiRoom');
    if (!lecture) return res.status(404).json({ message: 'Not found' });
    res.json({
      transcript: lecture.transcript, is_live: lecture.isLive,
      summary: lecture.summary, detected_topics: lecture.detectedTopics,
      jitsi_room: lecture.jitsiRoom
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/lectures/:id/end — end lecture + full AI pipeline
router.post('/:id/end', auth, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });
    if (lecture.teacher.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only the host can end the lecture' });

    lecture.isLive  = false;
    lecture.endedAt = new Date();

    const wordCount = lecture.transcript.split(/\s+/).filter(Boolean).length;
    if (wordCount > 15) {
      // 1. AI Notes
      try {
        const notesPrompt = `Convert this raw lecture transcript into beautifully structured markdown notes.
Include: clear ## section headers, **bold** key terms, bullet points, examples, and a Key Takeaways section.
Transcript: ${lecture.transcript}`;
        const summary = await gemini(notesPrompt, req.user.geminiApiKey);
        lecture.summary = summary;
        await Note.create({ user: req.user._id, title: `📝 Lecture: ${lecture.title}`, content: summary });
      } catch (e) { lecture.summary = 'Notes generation failed.'; }

      // 2. Topic Detection
      try {
        const topicPrompt = `From this lecture transcript, extract up to 5 main topics being taught.
Return ONLY a JSON array of strings. No markdown. Example: ["Neural Networks","Backpropagation"]
Transcript: ${lecture.transcript.slice(0, 3000)}`;
        const topicRaw = await gemini(topicPrompt, req.user.geminiApiKey);
        const topics   = JSON.parse(topicRaw.replace(/```json|```/g, '').trim());
        lecture.detectedTopics = topics;
        // Auto-create topics in knowledge base
        for (const name of topics.slice(0, 5)) {
          const exists = await Topic.findOne({ user: req.user._id, title: name });
          if (!exists) await Topic.create({ user: req.user._id, title: name });
        }
      } catch (e) { lecture.detectedTopics = []; }

      // 3. Auto Quiz
      try {
        const quizPrompt = `From this lecture transcript, generate exactly 5 MCQs to test student comprehension.
Return ONLY a JSON array (no markdown):
[{"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":0,"explanation":"..."}]
Transcript: ${lecture.transcript.slice(0, 3000)}`;
        const quizRaw = await gemini(quizPrompt, req.user.geminiApiKey);
        lecture.autoQuiz = JSON.parse(quizRaw.replace(/```json|```/g, '').trim());
      } catch (e) { lecture.autoQuiz = []; }

      // 4. Second Brain — chunk + store
      try {
        const chunks = chunkText(lecture.transcript);
        await Document.create({
          user: req.user._id,
          title: `Lecture Transcript: ${lecture.title}`,
          content: lecture.transcript.slice(0, 1000),
          sourceType: 'lecture',
          chunks
        });
      } catch (e) { /* non-fatal */ }
    }

    await lecture.save();
    res.json(lecture);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/lectures/:id/chat — send chat message
router.post('/:id/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    const chatMsg = { user: req.user._id, message, isAiResponse: false };
    lecture.chatMessages.push(chatMsg);
    await lecture.save();

    const saved = lecture.chatMessages[lecture.chatMessages.length - 1];
    res.json({ id: saved._id, user_id: req.user._id, user_email: req.user.email, message, is_ai_response: false, created_at: saved.createdAt || new Date() });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/lectures/:id/chat — fetch chat messages
router.get('/:id/chat', auth, async (req, res) => {
  try {
    const afterId = req.query.after_id;
    const lecture = await Lecture.findById(req.params.id).populate('chatMessages.user', 'email');
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    let msgs = lecture.chatMessages;
    if (afterId) {
      const idx = msgs.findIndex(m => m._id.toString() === afterId);
      msgs = idx >= 0 ? msgs.slice(idx + 1) : msgs;
    }

    const User = require('../models/User');
    const result = await Promise.all(msgs.map(async m => {
      const user = await User.findById(m.user).select('email');
      return { id: m._id, user_id: m.user, user_email: user?.email || 'Unknown', message: m.message, is_ai_response: m.isAiResponse, created_at: m.createdAt };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/lectures/:id/raise-hand — toggle raise hand
router.post('/:id/raise-hand', auth, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    const idx = lecture.raisedHands.findIndex(h => h.toString() === req.user._id.toString());
    if (idx >= 0) {
      lecture.raisedHands.splice(idx, 1);
      await lecture.save();
      return res.json({ status: 'lowered' });
    }
    lecture.raisedHands.push(req.user._id);
    await lecture.save();
    res.json({ status: 'raised' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/lectures/:id/hands
router.get('/:id/hands', auth, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id).populate('raisedHands', 'email');
    if (!lecture) return res.status(404).json({ message: 'Not found' });
    res.json(lecture.raisedHands.map(u => ({ user_id: u._id, email: u.email })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/lectures/:id/detect-topic — AI mid-lecture topic detection
router.post('/:id/detect-topic', auth, async (req, res) => {
  try {
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    const words = lecture.transcript.split(/\s+/);
    if (words.length < 20) return res.json({ topic: 'Listening...' });

    const recent = words.slice(-200).join(' ');
    const prompt = `From this recent lecture excerpt, identify the single main topic being discussed.
Return ONLY the topic name. Example: "Database Normalization"
Excerpt: ${recent}`;

    const topic = (await gemini(prompt, req.user.geminiApiKey)).trim().replace(/^["']|["']$/g, '');
    if (topic && !lecture.detectedTopics.includes(topic)) {
      lecture.detectedTopics.push(topic);
      await lecture.save();
    }
    res.json({ topic });
  } catch (err) { res.json({ topic: 'Detection unavailable' }); }
});

// POST /api/lectures/:id/ask-ai — lecture-scoped RAG query
router.post('/:id/ask-ai', auth, async (req, res) => {
  try {
    const { question } = req.body;
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    const context = lecture.transcript.length > 30
      ? `LECTURE CONTEXT (use this as reference if relevant):\n${lecture.transcript.slice(0, 4000)}\n\n${lecture.summary ? 'AI NOTES:\n' + lecture.summary : ''}`
      : '';

    const prompt = `You are NeuroBase AI Tutor — an expert educator who gives comprehensive, accurate answers.
${context ? context + '\n\n' : ''}STUDENT QUESTION: ${question}

Instructions:
- Answer the question thoroughly using your full knowledge base
- If the lecture context above is relevant, weave it in naturally
- If the topic wasn't covered in the lecture, that's fine — still give a complete answer
- Use markdown formatting: **bold** key terms, bullet points, code blocks where helpful
- Be educational, clear, and detailed`;

    const answer = await gemini(prompt, req.user.geminiApiKey);
    // Save as AI chat message
    lecture.chatMessages.push({ user: req.user._id, message: `**Q:** ${question}\n\n**A:** ${answer}`, isAiResponse: true });
    await lecture.save();
    res.json({ answer });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/lectures/:id/review — full post-class data
router.get('/:id/review', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    const room    = await Classroom.findById(lecture.classroom).select('name');
    const chatList = await Promise.all(lecture.chatMessages.map(async m => {
      const user = await User.findById(m.user).select('email');
      return { id: m._id, user_email: user?.email || 'Unknown', message: m.message, is_ai_response: m.isAiResponse, created_at: m.createdAt };
    }));

    res.json({
      id: lecture._id, title: lecture.title,
      classroom_name: room?.name || '', classroom_id: lecture.classroom,
      transcript: lecture.transcript, summary: lecture.summary,
      detected_topics: lecture.detectedTopics, auto_quiz: lecture.autoQuiz,
      is_live: lecture.isLive,
      started_at: lecture.createdAt, ended_at: lecture.endedAt,
      chat_history: chatList
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/lectures/:id/submit-quiz — quiz results + weakness detection
router.post('/:id/submit-quiz', auth, async (req, res) => {
  try {
    const { score, total_questions } = req.body;
    const lecture = await Lecture.findById(req.params.id);
    if (!lecture) return res.status(404).json({ message: 'Not found' });

    await QuizAttempt.create({ user: req.user._id, lecture: lecture._id, score, totalQuestions: total_questions });

    const pct = total_questions > 0 ? (score / total_questions) * 100 : 0;
    if (pct < 60) {
      for (const topic of lecture.detectedTopics.slice(0, 3)) {
        await KnowledgeGap.create({
          user: req.user._id,
          description: `Weak quiz score (${pct.toFixed(0)}%) on lecture "${lecture.title}" — topic: ${topic}`,
          suggestedTopic: topic, source: 'lecture'
        });
      }
    }
    res.json({ message: 'Quiz submitted', score_pct: pct.toFixed(1) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
