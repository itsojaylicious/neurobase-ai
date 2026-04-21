const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:          { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
  lecture:        { type: mongoose.Schema.Types.ObjectId, ref: 'Lecture', default: null },
  score:          { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
}, { timestamps: true });

const KnowledgeGapSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description:    { type: String, required: true },
  suggestedTopic: { type: String, default: '' },
  source:         { type: String, enum: ['quiz', 'lecture', 'chat'], default: 'quiz' },
}, { timestamps: true });

module.exports = {
  QuizAttempt:  mongoose.model('QuizAttempt', QuizAttemptSchema),
  KnowledgeGap: mongoose.model('KnowledgeGap', KnowledgeGapSchema),
};
