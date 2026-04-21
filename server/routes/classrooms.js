const router    = require('express').Router();
const auth      = require('../middleware/auth');
const { Classroom } = require('../models/Classroom');
const { v4: uuidv4 } = require('uuid');
const multer    = require('multer');
const Document  = require('../models/Document');
const { chunkText } = require('../services/ai');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

// POST /api/classrooms — create classroom (teacher only)
router.post('/', auth, async (req, res) => {
  try {
    if (!['teacher', 'admin'].includes(req.user.role))
      return res.status(403).json({ message: 'Only teachers can create classrooms' });

    const { name, subject, description, schedule } = req.body;
    const joinCode = uuidv4().slice(0, 8).toUpperCase();
    const room = await Classroom.create({ teacher: req.user._id, name, subject, description, schedule, joinCode });
    res.status(201).json(room);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/classrooms/join — student join
router.post('/join', auth, async (req, res) => {
  try {
    const { join_code } = req.body;
    const room = await Classroom.findOne({ joinCode: join_code });
    if (!room) return res.status(404).json({ message: 'Classroom not found' });
    if (room.teacher.toString() === req.user._id.toString())
      return res.status(400).json({ message: 'Teachers cannot enroll in their own class' });
    if (!room.enrollments.includes(req.user._id)) {
      room.enrollments.push(req.user._id);
      await room.save();
    }
    res.json(room);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/classrooms — list for current user
router.get('/', auth, async (req, res) => {
  try {
    const uid = req.user._id;
    const normalize = c => ({
      id: c._id, _id: c._id,
      name: c.name, subject: c.subject,
      description: c.description, schedule: c.schedule,
      join_code: c.joinCode, joinCode: c.joinCode,
      is_active: c.isActive, teacher: c.teacher,
      createdAt: c.createdAt
    });

    if (['teacher', 'admin'].includes(req.user.role)) {
      const teaching = await Classroom.find({ teacher: uid });
      const enrolled = await Classroom.find({ enrollments: uid });
      return res.json({ teaching: teaching.map(normalize), enrolled: enrolled.map(normalize) });
    }
    const enrolled = await Classroom.find({ enrollments: uid });
    res.json({ teaching: [], enrolled: enrolled.map(normalize) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/classrooms/:id — detail with lectures + students + materials
router.get('/:id', auth, async (req, res) => {
  try {
    const { Lecture } = require('../models/Classroom');
    const User = require('../models/User');

    const room = await Classroom.findById(req.params.id).populate('teacher', 'email');
    if (!room) return res.status(404).json({ message: 'Classroom not found' });

    // Access check
    const isTeacher  = room.teacher._id.toString() === req.user._id.toString() || req.user.role === 'admin';
    const isEnrolled = room.enrollments.map(e => e.toString()).includes(req.user._id.toString());
    if (!isTeacher && !isEnrolled) return res.status(403).json({ message: 'Not enrolled' });

    const lectures = await Lecture.find({ classroom: req.params.id }).sort({ createdAt: -1 })
      .select('title isLive createdAt endedAt detectedTopics summary autoQuiz');

    const lectureList = lectures.map(l => ({
      id: l._id, title: l.title, is_live: l.isLive,
      started_at: l.createdAt, ended_at: l.endedAt,
      detected_topics: l.detectedTopics,
      has_summary: !!l.summary, has_quiz: Array.isArray(l.autoQuiz) && l.autoQuiz.length > 0
    }));

    const students = await User.find({ _id: { $in: room.enrollments } }).select('email createdAt');

    res.json({
      id: room._id, name: room.name, subject: room.subject,
      description: room.description, schedule: room.schedule,
      join_code: room.joinCode, teacher_id: room.teacher._id,
      is_active: room.isActive, student_count: room.enrollments.length,
      lectures: lectureList, materials: room.materials,
      students: students.map(s => ({ id: s._id, email: s.email }))
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/classrooms/:id
router.delete('/:id', auth, async (req, res) => {
  const room = await Classroom.findById(req.params.id);
  if (!room) return res.status(404).json({ message: 'Not found' });
  if (room.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin')
    return res.status(403).json({ message: 'Not authorized' });
  await room.deleteOne();
  res.json({ message: 'Classroom deleted' });
});

// POST /api/classrooms/:id/materials
router.post('/:id/materials', auth, async (req, res) => {
  try {
    const room = await Classroom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Not found' });
    if (room.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only teacher can add materials' });

    const { title, content, material_type } = req.body;
    room.materials.push({ title, content, materialType: material_type || 'note' });
    await room.save();
    res.json(room.materials[room.materials.length - 1]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/classrooms/:id/materials/:matId
router.delete('/:id/materials/:matId', auth, async (req, res) => {
  try {
    const room = await Classroom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Not found' });
    room.materials = room.materials.filter(m => m._id.toString() !== req.params.matId);
    await room.save();
    res.json({ message: 'Material deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/classrooms/:id/materials/upload — teacher uploads a file as class material
// It also creates a Document in ALL enrolled students' knowledge bases
router.post('/:id/materials/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const room = await Classroom.findById(req.params.id).populate('enrollments', '_id');
    if (!room) return res.status(404).json({ message: 'Not found' });
    if (room.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only the teacher can upload class materials' });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const title    = req.file.originalname;
    const ext      = title.split('.').pop().toLowerCase();
    const sourceType = ext === 'pdf' ? 'pdf' : 'txt';

    // Extract text
    let text = '';
    if (ext === 'pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(req.file.buffer);
        text = data.text || '';
      } catch(e) { text = req.file.buffer.toString('utf-8'); }
    } else {
      text = req.file.buffer.toString('utf-8');
    }

    const chunks = text.trim().length > 10 ? chunkText(text) : [];
    const classLabel = `[${room.name}] ${title}`;

    // Save as material in classroom (text content for inline view)
    room.materials.push({ title: classLabel, content: text.slice(0, 2000), materialType: ext });
    await room.save();
    const newMaterial = room.materials[room.materials.length - 1];

    // Push Document to all enrolled students' knowledge bases
    const studentIds = room.enrollments.map(e => e._id || e);
    const docInserts = studentIds.map(uid => ({
      user: uid, title: classLabel, content: text, sourceType, chunks
    }));
    if (docInserts.length > 0) {
      await Document.insertMany(docInserts);
    }

    res.status(201).json({ material: newMaterial, pushed_to: studentIds.length + ' students' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
