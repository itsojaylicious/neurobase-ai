const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
  text:       { type: String, required: true },
  chunkIndex: { type: Number, default: 0 },
});

const DocumentSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:      { type: String, required: true },
  content:    { type: String, default: '' },   // extracted text (for AI/search)
  rawFile:    { type: Buffer, default: null },  // original file bytes (for inline viewing)
  mimeType:   { type: String, default: '' },    // e.g. 'application/pdf'
  sourceType: { type: String, enum: ['pdf', 'txt', 'lecture', 'link'], default: 'txt' },
  chunks:     [ChunkSchema],
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
