import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Loader2, BookOpen, Target, Brain } from 'lucide-react';
import api from '../api/client';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/topics'),
      api.get('/quiz/gaps'),
      api.get('/progress/dashboard')
    ]).then(([topicsRes, gapsRes, dashRes]) => {
      setData({
        topic_strengths: topicsRes.data || [],
        quiz_history: [],
        gaps: gapsRes.data || [],
        stats: dashRes.data?.stats || {}
      });
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const topicStrengths = data?.topic_strengths || [];
  const quizHistory = data?.quiz_history || [];
  const gaps = data?.gaps || [];

  const strong = topicStrengths.filter(t => t.status === 'Strong').length;
  const medium = topicStrengths.filter(t => t.status === 'Medium').length;
  const weak = topicStrengths.filter(t => t.status === 'Weak').length;
  const neutral = topicStrengths.filter(t => t.status === 'Neutral').length;

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Analytics</h1>
        <p className="text-gray-400 mt-1">Track your learning progress and performance</p>
      </div>

      {topicStrengths.length === 0 && quizHistory.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No data yet. Start learning and taking quizzes to see analytics!</p>
          <Link to="/topics" className="primary-btn inline-flex">Get Started</Link>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 text-center">
              <p className="text-3xl font-bold text-emerald-400">{strong}</p>
              <p className="text-sm text-gray-400 mt-1">Strong</p>
            </div>
            <div className="glass-panel p-5 text-center">
              <p className="text-3xl font-bold text-amber-400">{medium}</p>
              <p className="text-sm text-gray-400 mt-1">Medium</p>
            </div>
            <div className="glass-panel p-5 text-center">
              <p className="text-3xl font-bold text-red-400">{weak}</p>
              <p className="text-sm text-gray-400 mt-1">Weak</p>
            </div>
            <div className="glass-panel p-5 text-center">
              <p className="text-3xl font-bold text-gray-400">{neutral}</p>
              <p className="text-sm text-gray-400 mt-1">Untested</p>
            </div>
          </div>

          {/* Topic Strength Breakdown */}
          {topicStrengths.length > 0 && (
            <div className="glass-panel p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 font-display">
                <BookOpen className="w-5 h-5 text-primary-400" />
                Topic Strength Breakdown
              </h2>
              <div className="space-y-4">
                {topicStrengths.map(topic => (
                  <div key={topic.id} className="flex items-center gap-4">
                    <Link to={`/topics/${topic.id}`} className="flex-1 min-w-0">
                      <p className="font-medium text-gray-200 truncate hover:text-primary-300 transition-colors">{topic.title}</p>
                      <p className="text-xs text-gray-500">{topic.notes_count}/{topic.subtopic_count} notes generated</p>
                    </Link>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-28 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          topic.status === 'Strong' ? 'bg-emerald-500' :
                          topic.status === 'Medium' ? 'bg-amber-500' :
                          topic.status === 'Weak' ? 'bg-red-500' :
                          'bg-gray-600'
                        }`} style={{
                          width: topic.status === 'Strong' ? '100%' :
                                 topic.status === 'Medium' ? '66%' :
                                 topic.status === 'Weak' ? '33%' : '10%'
                        }}></div>
                      </div>
                      <span className={`text-xs font-medium w-16 text-right ${
                        topic.status === 'Strong' ? 'text-emerald-400' :
                        topic.status === 'Medium' ? 'text-amber-400' :
                        topic.status === 'Weak' ? 'text-red-400' :
                        'text-gray-500'
                      }`}>{topic.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quiz History */}
          {quizHistory.length > 0 && (
            <div className="glass-panel p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 font-display">
                <Brain className="w-5 h-5 text-primary-400" />
                Quiz History
              </h2>
              <div className="space-y-3">
                {quizHistory.map((q, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/30">
                    <div>
                      <p className="font-medium text-gray-200 text-sm">{q.topic_title}</p>
                      <p className="text-xs text-gray-500">{new Date(q.created_at).toLocaleDateString()} • {q.score}/{q.total} correct</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          q.percentage >= 80 ? 'bg-emerald-500' :
                          q.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${q.percentage}%` }}></div>
                      </div>
                      <span className={`text-sm font-bold min-w-[3rem] text-right ${
                        q.percentage >= 80 ? 'text-emerald-400' :
                        q.percentage >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>{q.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Gaps Summary */}
          {gaps.length > 0 && (
            <div className="glass-panel p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 font-display">
                <Target className="w-5 h-5 text-red-400" />
                Knowledge Gaps ({gaps.length})
              </h2>
              <div className="space-y-2">
                {gaps.map(gap => (
                  <div key={gap.id} className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-gray-300">
                    {gap.description}
                    {gap.suggested_topic && (
                      <span className="text-primary-400 ml-1">→ Study: {gap.suggested_topic}</span>
                    )}
                  </div>
                ))}
              </div>
              <Link to="/gaps" className="text-sm text-primary-400 hover:text-primary-300 mt-3 inline-block transition-colors">
                View all gaps →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
