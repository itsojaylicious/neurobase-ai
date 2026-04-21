const axios = require('axios');

/**
 * Call Google Gemini API — single source of truth for all AI calls.
 * @param {string} prompt
 * @param {string} [apiKey] - optional per-user key; falls back to env
 */
async function gemini(prompt, apiKey) {
  // Skip empty/masked per-user keys, always fall back to env
  const key = (apiKey && apiKey !== '***' && apiKey.length > 5) ? apiKey : process.env.GEMINI_API_KEY;
  if (!key) return 'AI Error: GEMINI_API_KEY not configured.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }]
    }, { timeout: 90000 });
    return res.data.candidates[0].content.parts[0].text;
  } catch (err) {
    const status = err.response?.status;
    const msg    = err.response?.data?.error?.message || err.message;
    return `AI Error (${status || 'timeout'}): ${msg}`;
  }
}

// ── RAG: chunk a body of text into ~500 word pieces ─────
function chunkText(text, size = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push({ text: words.slice(i, i + size).join(' '), chunkIndex: chunks.length });
  }
  return chunks;
}

// ── RAG: simple keyword retrieval over chunks ────────────
function retrieveRelevantChunks(query, chunks, topK = 5) {
  const qWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const scored = chunks.map(chunk => {
    const text = (chunk.text || '').toLowerCase();
    let score = 0;
    qWords.forEach(word => { if (text.includes(word)) score++; });
    return { text: chunk.text, score };
  });
  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(c => c.text);
}

module.exports = { gemini, chunkText, retrieveRelevantChunks };
