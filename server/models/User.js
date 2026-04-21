const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email:          { type: String, required: true, unique: true, lowercase: true },
  password:       { type: String, required: true },
  role:           { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  displayName:    { type: String, default: '' },
  learningStyle:  { type: String, enum: ['visual', 'reading', 'practice', 'balanced'], default: 'balanced' },
  theme:          { type: String, enum: ['dark', 'light'], default: 'dark' },
  geminiApiKey:   { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
