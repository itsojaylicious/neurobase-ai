import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Loader2, BookOpen, RotateCcw, ChevronRight, Sparkles, Trophy, Brain, Trash2, Clock } from 'lucide-react';
import api from '../api/client';

export default function FlashcardsPage() {
  const [topics, setTopics] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [dueCards, setDueCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState('overview'); // overview, review
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionScore, setSessionScore] = useState({ total: 0, correct: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsRes, cardsRes, dueRes, statsRes] = await Promise.all([
        api.get('/topic/'),
        api.get('/flashcards/'),
        api.get('/flashcards/due'),
        api.get('/flashcards/stats')
      ]);
      setTopics(topicsRes.data.topics || []);
      setFlashcards(cardsRes.data.flashcards || []);
      setDueCards(dueRes.data.flashcards || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleGenerate = async (topicId) => {
    setGenerating(true);
    try {
      await api.post('/flashcards/generate', { topic_id: topicId });
      await loadData();
    } catch (e) {
      alert('Failed to generate flashcards.');
    }
    setGenerating(false);
  };

  const startReview = () => {
    if (dueCards.length === 0) return;
    setMode('review');
    setCurrentIndex(0);
    setFlipped(false);
    setSessionScore({ total: 0, correct: 0 });
  };

  const handleReview = async (quality) => {
    const card = dueCards[currentIndex];
    try {
      await api.put(`/flashcards/${card.id}/review`, { quality });
      setSessionScore(prev => ({
        total: prev.total + 1,
        correct: quality >= 2 ? prev.correct + 1 : prev.correct
      }));
    } catch (e) {
      console.error(e);
    }

    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setFlipped(false);
    } else {
      setMode('complete');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this flashcard?')) return;
    try {
      await api.delete(`/flashcards/${id}`);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  // ── Review Complete ──
  if (mode === 'complete') {
    const pct = sessionScore.total > 0 ? Math.round(sessionScore.correct / sessionScore.total * 100) : 0;
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center h-full gap-6">
        <div className="glass-panel p-10 text-center max-w-md w-full">
          <Trophy className={`w-16 h-16 mx-auto mb-4 ${pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`} />
          <h2 className="text-3xl font-bold text-white font-display mb-2">Session Complete!</h2>
          <p className="text-gray-400 mb-4">You reviewed {sessionScore.total} cards</p>
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{sessionScore.correct}</p>
              <p className="text-xs text-gray-500">Correct</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{sessionScore.total - sessionScore.correct}</p>
              <p className="text-xs text-gray-500">Needs Review</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-400">{pct}%</p>
              <p className="text-xs text-gray-500">Accuracy</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { loadData(); setMode('overview'); }} className="primary-btn">Back to Overview</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Review Mode ──
  if (mode === 'review' && dueCards.length > 0) {
    const card = dueCards[currentIndex];
    return (
      <div className="animate-slide-up flex flex-col items-center justify-center h-full gap-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between w-full">
          <button onClick={() => { setMode('overview'); loadData(); }} className="secondary-btn text-xs">← Exit Review</button>
          <span className="text-sm text-gray-400">{currentIndex + 1} / {dueCards.length}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-primary-500 transition-all duration-500 rounded-full" style={{ width: `${((currentIndex) / dueCards.length) * 100}%` }}></div>
        </div>

        {/* Card */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="glass-panel w-full min-h-[300px] p-8 cursor-pointer flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-primary-500/30 transition-all"
          style={{ perspective: '1000px' }}
        >
          <div className={`absolute top-3 right-3 text-xs px-2 py-1 rounded-full border ${
            card.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
            card.difficulty === 'hard' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
            'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}>{card.difficulty}</div>

          {!flipped ? (
            <div className="animate-fade-in">
              <p className="text-xs text-primary-400 uppercase tracking-wider mb-4 font-medium">Question</p>
              <p className="text-xl text-white font-medium leading-relaxed">{card.front}</p>
              <p className="text-xs text-gray-500 mt-6">Click to reveal answer</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-4 font-medium">Answer</p>
              <p className="text-lg text-gray-200 leading-relaxed">{card.back}</p>
            </div>
          )}
        </div>

        {/* Review buttons */}
        {flipped && (
          <div className="flex gap-3 w-full animate-fade-in">
            <button onClick={() => handleReview(0)} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-medium">
              <RotateCcw className="w-4 h-4 mx-auto mb-1" /> Again
            </button>
            <button onClick={() => handleReview(1)} className="flex-1 py-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all text-sm font-medium">
              Hard
            </button>
            <button onClick={() => handleReview(2)} className="flex-1 py-3 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all text-sm font-medium">
              Good
            </button>
            <button onClick={() => handleReview(3)} className="flex-1 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all text-sm font-medium">
              Easy
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Overview Mode ──
  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Flashcards</h1>
        <p className="text-gray-400 mt-1">AI-generated flashcards with spaced repetition</p>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">Total Cards</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.due}</p>
            <p className="text-xs text-gray-400 mt-1">Due Now</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{stats.learning}</p>
            <p className="text-xs text-gray-400 mt-1">Learning</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.mastered}</p>
            <p className="text-xs text-gray-400 mt-1">Mastered</p>
          </div>
        </div>
      )}

      {/* Review CTA */}
      {dueCards.length > 0 && (
        <div className="glass-panel p-6 border-primary-500/30 bg-primary-600/10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-600/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white font-display">{dueCards.length} cards due for review</h2>
                <p className="text-sm text-gray-400">Review now to strengthen your memory</p>
              </div>
            </div>
            <button onClick={startReview} className="primary-btn">
              <Brain className="w-5 h-5 mr-2" /> Start Review
            </button>
          </div>
        </div>
      )}

      {/* Generate from Topics */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Generate Flashcards</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Select a topic to automatically generate flashcards with AI</p>

        {topics.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-3">No topics available. Create a topic first!</p>
            <Link to="/topics" className="primary-btn inline-flex"><BookOpen className="w-5 h-5 mr-2" /> Go to Topics</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map(topic => (
              <button
                key={topic.id}
                onClick={() => handleGenerate(topic.id)}
                disabled={generating}
                className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-primary-500/30 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-200 text-sm group-hover:text-primary-300 transition-colors">{topic.title}</span>
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-primary-400 transition-colors shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* All Flashcards List */}
      {flashcards.length > 0 && (
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-white mb-4 font-display flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-400" /> All Flashcards ({flashcards.length})
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {flashcards.map(card => (
              <div key={card.id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/30 group hover:border-gray-600/50 transition-all">
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm text-gray-200 truncate">{card.front}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      card.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400' :
                      card.difficulty === 'hard' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{card.difficulty}</span>
                    {card.topic && <span className="text-xs text-gray-500">{card.topic.title}</span>}
                    <span className="text-xs text-gray-600">Rep: {card.repetitions}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(card.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
