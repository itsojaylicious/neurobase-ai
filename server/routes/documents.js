const router   = require('express').Router();
const auth     = require('../middleware/auth');
const Document = require('../models/Document');
const multer   = require('multer');
const { chunkText } = require('../services/ai');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Helper: extract text from buffer ──────────────────────────────────────
async function extractText(buffer, mimetype, originalname) {
  const ext = (originalname || '').split('.').pop().toLowerCase();
  if (ext === 'pdf' || mimetype === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e) {
      console.warn('PDF text extraction failed (might be scanned):', e.message);
      return '';   // empty — we still keep the raw file for visual viewing
    }
  }
  return buffer.toString('utf-8');
}

// POST /api/documents/upload
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const title      = req.file.originalname;
    const ext        = title.split('.').pop().toLowerCase();
    const sourceType = ext === 'pdf' ? 'pdf' : 'txt';
    const mimeType   = req.file.mimetype || (ext === 'pdf' ? 'application/pdf' : 'text/plain');

    // Extract text (may be empty for scanned PDFs — that's OK)
    const text   = await extractText(req.file.buffer, mimeType, title);
    const chunks = text.trim().length > 10 ? chunkText(text) : [];

    const doc = await Document.create({
      user:      req.user._id,
      title,
      content:   text,             // extracted text for AI (may be empty for scanned)
      rawFile:   req.file.buffer,  // ALWAYS store original bytes for visual viewing
      mimeType,
      sourceType,
      chunks
    });

    const warningMsg = (sourceType === 'pdf' && chunks.length === 0)
      ? 'PDF uploaded (scanned/image-based — visual preview available but AI text search disabled).'
      : null;

    res.status(201).json({
      id: doc._id, _id: doc._id, title: doc.title,
      source_type: doc.sourceType,
      chunks_count: chunks.length,
      has_raw_file: true,
      warning: warningMsg,
      created_at: doc.createdAt
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/documents/text — paste raw text
router.post('/text', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ message: 'Title and content required' });
    const chunks = chunkText(content);
    const doc = await Document.create({
      user: req.user._id, title, content,
      sourceType: 'txt', mimeType: 'text/plain', chunks
    });
    res.status(201).json({
      id: doc._id, _id: doc._id, title: doc.title,
      source_type: doc.sourceType, chunks_count: chunks.length,
      has_raw_file: false, created_at: doc.createdAt
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/documents — list
router.get('/', auth, async (req, res) => {
  try {
    const docs = await Document.find({ user: req.user._id }, 'title sourceType mimeType createdAt chunks rawFile').sort({ createdAt: -1 });
    res.json(docs.map(d => ({
      id: d._id, _id: d._id, title: d.title,
      source_type: d.sourceType, mimeType: d.mimeType,
      chunks_count: d.chunks?.length || 0,
      has_raw_file: !!(d.rawFile && d.rawFile.length > 0),
      created_at: d.createdAt
    })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/documents/:id — metadata + extracted text (no rawFile)
router.get('/:id', auth, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user: req.user._id }, '-rawFile');
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({
      id: doc._id, _id: doc._id, title: doc.title,
      source_type: doc.sourceType, mimeType: doc.mimeType,
      content: doc.content, chunks_count: doc.chunks?.length || 0,
      created_at: doc.createdAt
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/documents/:id/file — serve raw file (for iframe viewer + download)
router.get('/:id/file', auth, async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, user: req.user._id }, 'rawFile mimeType title sourceType content');
    if (!doc) return res.status(404).send('Not found');

    const isDownload = req.query.download === '1';

    // If we have the raw file, serve it directly
    if (doc.rawFile && doc.rawFile.length > 0) {
      const mime = doc.mimeType || (doc.sourceType === 'pdf' ? 'application/pdf' : 'text/plain');
      res.set('Content-Type', mime);
      res.set('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.title)}"`);
      res.set('Content-Length', doc.rawFile.length);
      return res.send(doc.rawFile);
    }

    // Fallback: serve extracted text as plain text (for old docs without rawFile)
    if (doc.content) {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.title)}.txt"`);
      return res.send(doc.content);
    }

    res.status(404).send('No file content available. Please re-upload this document.');
  } catch (err) { res.status(500).send(err.message); }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  await Document.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  res.json({ message: 'Deleted' });
});

module.exports = router;
