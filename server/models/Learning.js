const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role:    { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const FlashcardSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:       { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
  front:       { type: String, required: true },
  back:        { type: String, required: true },
  difficulty:  { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  easeFactor:  { type: Number, default: 2.5 },
  interval:    { type: Number, default: 0 },
  repetitions: { type: Number, default: 0 },
  nextReview:  { type: Date, default: Date.now },
}, { timestamps: true });

const NoteSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:    { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
  title:    { type: String, required: true },
  content:  { type: String, default: '' },
  isPinned: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = {
  ChatMessage: mongoose.model('ChatMessage', ChatMessageSchema),
  Flashcard:   mongoose.model('Flashcard', FlashcardSchema),
  Note:        mongoose.model('Note', NoteSchema),
};
