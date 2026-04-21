const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  content:      { type: String, default: '' },
  materialType: { type: String, default: 'note' },  // no enum restriction — accepts pdf, txt, note, link, etc.
}, { timestamps: true });

const ClassroomSchema = new mongoose.Schema({
  teacher:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true },
  subject:     { type: String, default: '' },
  description: { type: String, default: '' },
  schedule:    { type: String, default: '' },
  joinCode:    { type: String, required: true, unique: true },
  isActive:    { type: Boolean, default: true },
  enrollments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  materials:   [MaterialSchema],
}, { timestamps: true });

const LectureChatSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:      { type: String, required: true },
  isAiResponse: { type: Boolean, default: false },
}, { timestamps: true });

const LectureSchema = new mongoose.Schema({
  classroom:      { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  teacher:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:          { type: String, required: true },
  transcript:     { type: String, default: '' },
  summary:        { type: String, default: '' },
  detectedTopics: { type: [String], default: [] },
  autoQuiz:       { type: mongoose.Schema.Types.Mixed, default: [] }, // Array of MCQ objects
  isLive:         { type: Boolean, default: true },
  jitsiRoom:      { type: String, default: '' },
  raisedHands:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  chatMessages:   [LectureChatSchema],
  endedAt:        { type: Date, default: null },
}, { timestamps: true });

module.exports = {
  Classroom: mongoose.model('Classroom', ClassroomSchema),
  Lecture:   mongoose.model('Lecture', LectureSchema),
};
