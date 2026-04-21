import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Brain, TrendingUp, Sparkles, ArrowRight, Loader2, Layers, StickyNote, Bell, Users } from 'lucide-react';
import api from '../api/client';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));

    // Load smart notifications
    api.get('/analytics/student')
      .then(res => setReminders(res.data.reminders || []))
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const stats = data?.stats || {};
  const insights = data?.insights || [];
  const recentTopics = data?.recent_topics || [];

  const statCards = [
    { label: 'Topics', value: stats.total_topics || 0, icon: BookOpen, color: 'from-blue-500 to-blue-600', link: '/topics' },
    { label: 'Documents', value: stats.total_documents || 0, icon: FileText, color: 'from-emerald-500 to-emerald-600', link: '/documents' },
    { label: 'Quizzes Taken', value: stats.total_quizzes || 0, icon: Brain, color: 'from-purple-500 to-purple-600', link: '/quiz' },
    { label: 'Avg Score', value: `${stats.avg_score || 0}%`, icon: TrendingUp, color: 'from-amber-500 to-amber-600', link: '/analytics' },
  ];

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Dashboard</h1>
        <p className="text-gray-400 mt-1">Your learning overview at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="glass-panel p-5 group cursor-pointer hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights */}
        <div className="lg:col-span-2 glass-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-semibold text-white font-display">Daily AI Insights</h2>
          </div>
          {insights.length === 0 ? (
            <p className="text-gray-500">Start learning to get personalized insights!</p>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="p-3 bg-gray-800/50 rounded-xl text-sm text-gray-300 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
                  {insight}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topic Strength Overview */}
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-white mb-4 font-display">Topic Strength</h2>
          {stats.total_topics === 0 ? (
            <p className="text-gray-500 text-sm">No topics yet. Generate your first one!</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Strong', count: stats.strong || 0, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                { label: 'Medium', count: stats.medium || 0, color: 'bg-amber-500', textColor: 'text-amber-400' },
                { label: 'Weak', count: stats.weak || 0, color: 'bg-red-500', textColor: 'text-red-400' },
                { label: 'Untested', count: stats.neutral || 0, color: 'bg-gray-500', textColor: 'text-gray-400' },
              ].map(({ label, count, color, textColor }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
                    <span className="text-sm text-gray-300">{label}</span>
                  </div>
                  <span className={`text-sm font-semibold ${textColor}`}>{count}</span>
                </div>
              ))}

              {/* Visual bar */}
              <div className="flex h-3 rounded-full overflow-hidden mt-2 bg-gray-800">
                {stats.strong > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(stats.strong / stats.total_topics) * 100}%` }}></div>}
                {stats.medium > 0 && <div className="bg-amber-500 transition-all duration-500" style={{ width: `${(stats.medium / stats.total_topics) * 100}%` }}></div>}
                {stats.weak > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${(stats.weak / stats.total_topics) * 100}%` }}></div>}
                {stats.neutral > 0 && <div className="bg-gray-600 transition-all duration-500" style={{ width: `${(stats.neutral / stats.total_topics) * 100}%` }}></div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Topics */}
      {recentTopics.length > 0 && (
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white font-display">Recent Topics</h2>
            <Link to="/topics" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentTopics.map(topic => (
              <Link key={topic.id} to={`/topics/${topic.id}`} className="p-4 bg-gray-800/40 rounded-xl border border-gray-700/50 hover:border-primary-500/30 transition-all group">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-200 group-hover:text-white text-sm">{topic.title}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    topic.status === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' :
                    topic.status === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                    topic.status === 'Weak' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-600/20 text-gray-400'
                  }`}>{topic.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Smart Notifications */}
      {reminders.length > 0 && (
        <div className="glass-panel p-5 border-yellow-500/20 bg-yellow-900/5">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-white">Smart Reminders</h3>
          </div>
          <div className="space-y-2">
            {reminders.map((r, i) => (
              <p key={i} className="text-sm text-gray-300 bg-gray-800/40 p-3 rounded-lg">{r}</p>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link to="/classrooms" className="glass-panel p-5 hover:border-red-500/30 transition-all group text-center">
          <Users className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="font-medium text-white">Live Classes</p>
          <p className="text-xs text-gray-500 mt-1">Join or teach live</p>
        </Link>
        <Link to="/topics" className="glass-panel p-5 hover:border-primary-500/30 transition-all group text-center">
          <BookOpen className="w-8 h-8 text-primary-400 mx-auto mb-2" />
          <p className="font-medium text-white">Generate Topic</p>
          <p className="text-xs text-gray-500 mt-1">AI builds a curriculum</p>
        </Link>
        <Link to="/documents" className="glass-panel p-5 hover:border-emerald-500/30 transition-all group text-center">
          <FileText className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="font-medium text-white">Upload Document</p>
          <p className="text-xs text-gray-500 mt-1">Feed your second brain</p>
        </Link>
        <Link to="/chat" className="glass-panel p-5 hover:border-purple-500/30 transition-all group text-center">
          <Brain className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="font-medium text-white">Ask AI Tutor</p>
          <p className="text-xs text-gray-500 mt-1">Search your knowledge</p>
        </Link>
        <Link to="/flashcards" className="glass-panel p-5 hover:border-amber-500/30 transition-all group text-center">
          <Layers className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="font-medium text-white">Flashcards</p>
          <p className="text-xs text-gray-500 mt-1">Spaced repetition review</p>
        </Link>
        <Link to="/notes" className="glass-panel p-5 hover:border-blue-500/30 transition-all group text-center">
          <StickyNote className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="font-medium text-white">Notes</p>
          <p className="text-xs text-gray-500 mt-1">Write & enhance with AI</p>
        </Link>
      </div>
    </div>
  );
}
