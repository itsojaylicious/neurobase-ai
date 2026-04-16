import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Sparkles, BookOpen } from 'lucide-react';
import api from '../api/client';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function TopicDetailPage() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchTopic = () => {
    api.get(`/topic/${id}`)
      .then(res => setTopic(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTopic(); }, [id]);

  const handleGenerateNotes = async (subtopicId) => {
    setGeneratingId(subtopicId);
    try {
      const res = await api.post('/topic/generate-notes', { subtopic_id: subtopicId });
      setTopic(prev => ({
        ...prev,
        subtopics: prev.subtopics.map(s =>
          s.id === subtopicId ? { ...s, content: res.data.content } : s
        )
      }));
      setExpandedId(subtopicId);
    } catch (e) {
      alert('Failed to generate notes. Please try again.');
    }
    setGeneratingId(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  if (!topic) return (
    <div className="text-center py-12 animate-fade-in">
      <p className="text-gray-400 text-lg">Topic not found</p>
      <Link to="/topics" className="text-primary-400 mt-2 inline-block hover:text-primary-300">← Back to topics</Link>
    </div>
  );

  const statusColors = {
    Strong: 'text-emerald-400',
    Medium: 'text-amber-400',
    Weak: 'text-red-400',
    Neutral: 'text-gray-400'
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/topics" className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">{topic.title}</h1>
          <p className={`text-sm ${statusColors[topic.status] || 'text-gray-400'}`}>
            Status: {topic.status} • {topic.subtopics?.length || 0} subtopics
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {topic.subtopics?.map((sub, index) => (
          <div key={sub.id} className="glass-panel overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/20 transition-colors"
              onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-primary-600/20 flex items-center justify-center text-xs font-bold text-primary-400 shrink-0">
                  {index + 1}
                </span>
                <span className="font-medium text-gray-200">{sub.title}</span>
                {sub.content && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Notes Ready
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!sub.content && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateNotes(sub.id); }}
                    disabled={generatingId === sub.id}
                    className="secondary-btn flex items-center gap-1 text-xs"
                  >
                    {generatingId === sub.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> Generate Notes</>
                    )}
                  </button>
                )}
                {expandedId === sub.id
                  ? <ChevronUp className="w-4 h-4 text-gray-500" />
                  : <ChevronDown className="w-4 h-4 text-gray-500" />
                }
              </div>
            </div>

            {expandedId === sub.id && sub.content && (
              <div className="px-6 pb-5 border-t border-gray-700/50 pt-4 animate-fade-in">
                <MarkdownRenderer content={sub.content} />
              </div>
            )}

            {expandedId === sub.id && !sub.content && (
              <div className="px-6 pb-5 border-t border-gray-700/50 pt-4 text-center animate-fade-in">
                <p className="text-gray-500 text-sm">No notes generated yet. Click "Generate Notes" to create study material.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quiz CTA */}
      <div className="glass-panel p-6 text-center">
        <h3 className="text-lg font-semibold text-white mb-2 font-display">Ready to test your knowledge?</h3>
        <p className="text-gray-400 text-sm mb-4">Take a quiz on {topic.title} to assess your understanding</p>
        <Link to={`/quiz?topic=${topic.id}`} className="primary-btn inline-flex">
          <BookOpen className="w-5 h-5 mr-2" /> Take Quiz
        </Link>
      </div>
    </div>
  );
}
