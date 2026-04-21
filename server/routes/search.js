const router   = require('express').Router();
const auth     = require('../middleware/auth');
const Document = require('../models/Document');
const Topic    = require('../models/Topic');
const { Note, Flashcard } = require('../models/Learning');
const { retrieveRelevantChunks } = require('../services/ai');

// GET /api/search?q=...
router.get('/', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ results: [] });

    const regex = new RegExp(q, 'i');
    const uid   = req.user._id;

    // Parallel search across all content types
    const [docs, topics, notes, flashcards] = await Promise.all([
      Document.find({ user: uid, title: regex }, 'title sourceType createdAt'),
      Topic.find({ user: uid, title: regex }, 'title status'),
      Note.find({ user: uid, $or: [{ title: regex }, { content: regex }] }, 'title content isPinned'),
      Flashcard.find({ user: uid, $or: [{ front: regex }, { back: regex }] }, 'front back'),
    ]);

    // RAG content search across document chunks
    const allDocs   = await Document.find({ user: uid });
    const allChunks = allDocs.flatMap(d => (d.chunks || []).map(c => ({ ...c.toObject(), docTitle: d.title, docId: d._id })));
    const relevant  = retrieveRelevantChunks(q, allChunks, 5);

    const results = [
      ...docs.map(d        => ({ type: 'document',  id: d._id,  title: d.title,  subtitle: d.sourceType, link: '/documents' })),
      ...topics.map(t      => ({ type: 'topic',     id: t._id,  title: t.title,  subtitle: `Status: ${t.status}`, link: `/topics/${t._id}` })),
      ...notes.map(n       => ({ type: 'note',      id: n._id,  title: n.title,  subtitle: n.content?.slice(0, 80), link: '/notes' })),
      ...flashcards.map(f  => ({ type: 'flashcard', id: f._id,  title: f.front,  subtitle: f.back?.slice(0, 80), link: '/flashcards' })),
      ...relevant.map((chunk, i) => ({ type: 'content', id: `rag-${i}`, title: 'Knowledge Match', subtitle: chunk.slice(0, 120), link: '/documents' })),
    ];

    res.json({ results, query: q });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
