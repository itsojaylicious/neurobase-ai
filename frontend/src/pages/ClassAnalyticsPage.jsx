import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, BookOpen, MessageSquare, Hand, Brain, BarChart3, Loader2, Award, AlertTriangle } from 'lucide-react';
import api from '../api/client';

export default function ClassAnalyticsPage() {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [classroomId]);

  const loadAnalytics = async () => {
    try {
      const res = await api.get(`/analytics/classroom/${classroomId}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (!data) return <div className="text-center text-gray-500 mt-20">Analytics not available</div>;

  return (
    <div className="animate-slide-up space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/classrooms')} className="p-2 hover:bg-gray-800 rounded-xl transition">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" /> {data.classroom_name} — Analytics
          </h1>
          <p className="text-xs text-gray-500">Teacher dashboard for classroom performance insights</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: data.student_count, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
          { label: 'Total Lectures', value: data.total_lectures, icon: BookOpen, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: 'Chat Messages', value: data.total_chat_messages, icon: MessageSquare, color: 'text-purple-400 bg-purple-500/10' },
          { label: 'Hand Raises', value: data.total_hand_raises, icon: Hand, color: 'text-yellow-400 bg-yellow-500/10' },
        ].map((card, i) => (
          <div key={i} className="glass-panel p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hot Topics */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-emerald-400" /> Most Discussed Topics</h3>
          {data.hot_topics.length === 0 ? (
            <p className="text-sm text-gray-500">No topics detected yet.</p>
          ) : (
            <div className="space-y-2">
              {data.hot_topics.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                  <span className="text-sm text-white">{t.topic}</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">{t.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Active Students */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400" /> Most Active Students</h3>
          {data.active_students.length === 0 ? (
            <p className="text-sm text-gray-500">No student activity yet.</p>
          ) : (
            <div className="space-y-2">
              {data.active_students.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs text-yellow-400 font-bold">{i + 1}</span>
                    <span className="text-sm text-white">{s.email}</span>
                  </div>
                  <span className="text-xs text-gray-400">{s.messages} msgs</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-Lecture Stats */}
      <div className="glass-panel p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-400" /> Lecture Performance</h3>
        {data.lecture_stats.length === 0 ? (
          <p className="text-sm text-gray-500">No lecture data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-800">
                  <th className="pb-3 pr-4">Lecture</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">💬 Chat</th>
                  <th className="pb-3 pr-4">✋ Hands</th>
                  <th className="pb-3 pr-4">📝 Quiz Attempts</th>
                  <th className="pb-3">📊 Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {data.lecture_stats.map((l, i) => (
                  <tr key={i} className="border-b border-gray-800/50 text-gray-300">
                    <td className="py-3 pr-4 font-medium text-white">{l.title}</td>
                    <td className="py-3 pr-4 text-xs">{l.date ? new Date(l.date).toLocaleDateString() : '-'}</td>
                    <td className="py-3 pr-4">{l.chat_messages}</td>
                    <td className="py-3 pr-4">{l.hand_raises}</td>
                    <td className="py-3 pr-4">{l.quiz_attempts}</td>
                    <td className="py-3">
                      <span className={`font-semibold ${l.avg_quiz_score >= 70 ? 'text-emerald-400' : l.avg_quiz_score > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                        {l.avg_quiz_score > 0 ? `${l.avg_quiz_score}%` : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
