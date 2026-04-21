import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus, Loader2, Trash2, ChevronRight, Sparkles } from 'lucide-react';
import api from '../api/client';

export default function TopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchTopics = () => {
    api.get('/topics')
      .then(res => setTopics(res.data || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTopics(); }, []);

  const handleGenerate = async () => {
    if (!newTopic.trim() || generating) return;
    setGenerating(true);
    try {
      await api.post('/topics', { title: newTopic });
      setNewTopic('');
      fetchTopics();
    } catch (e) {
      alert('Failed to generate topic. Please check your API key and try again.');
    }
    setGenerating(false);
  };

  const handleDelete = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this topic and all its subtopics?')) return;
    try {
      await api.delete(`/topics/${id}`);
      setTopics(topics.filter(t => (t._id || t.id) !== id));
    } catch (e) {
      alert('Failed to delete topic.');
    }
  };

  const statusConfig = {
    Strong: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '✅' },
    Medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: '⚠️' },
    Weak: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '❌' },
    Neutral: { color: 'bg-gray-600/20 text-gray-400 border-gray-600/30', icon: '📚' },
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Topics</h1>
        <p className="text-gray-400 mt-1">Generate AI-powered study modules on any subject</p>
      </div>

      {/* Generate New Topic */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Zero-Input Learning</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">Type any subject and AI will generate a structured learning path with subtopics and study notes.</p>
        <div className="flex gap-3">
          <input
            id="topic-input"
            type="text"
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. Operating Systems, Machine Learning, Data Structures..."
            className="input-field flex-1"
            disabled={generating}
          />
          <button id="topic-generate" onClick={handleGenerate} disabled={generating || !newTopic.trim()} className="primary-btn whitespace-nowrap">
            {generating ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating...</>
            ) : (
              <><Plus className="w-5 h-5 mr-2" /> Generate</>
            )}
          </button>
        </div>
      </div>

      {/* Topics List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : topics.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No topics yet. Generate your first one above!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map(topic => {
            const status = statusConfig[topic.status] || statusConfig.Neutral;
            const tid = topic._id || topic.id;
            return (
              <Link key={tid} to={`/topics/${tid}`} className="glass-panel p-5 group hover:border-primary-500/30 transition-all block">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg shrink-0">{status.icon}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-primary-300 transition-colors truncate">{topic.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${status.color}`}>{topic.status}</span>
                        <span className="text-xs text-gray-500">{topic.subtopics?.length || 0} subtopics</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => handleDelete(tid, e)} className="p-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
