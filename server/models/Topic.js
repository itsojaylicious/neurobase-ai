const mongoose = require('mongoose');

const SubtopicSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  content:     { type: String, default: '' },
  isGenerated: { type: Boolean, default: false },
});

const TopicSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true },
  status:    { type: String, enum: ['Strong', 'Medium', 'Weak', 'Neutral'], default: 'Neutral' },
  subtopics: [SubtopicSchema],
}, { timestamps: true });

module.exports = mongoose.model('Topic', TopicSchema);
