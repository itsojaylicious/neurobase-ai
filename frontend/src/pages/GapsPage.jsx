import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Target, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import api from '../api/client';

export default function GapsPage() {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/progress/gaps')
      .then(res => setGaps(res.data.gaps || []))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Knowledge Gaps</h1>
        <p className="text-gray-400 mt-1">AI-detected gaps in your learning. Address them to strengthen your knowledge!</p>
      </div>

      {gaps.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No knowledge gaps detected yet!</p>
          <p className="text-gray-500 text-sm">Take quizzes to let the AI analyze your strengths and weaknesses.</p>
          <Link to="/quiz" className="primary-btn mt-4 inline-flex">
            Take a Quiz
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass-panel p-4 border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">{gaps.length} knowledge gap{gaps.length !== 1 ? 's' : ''} detected</span>
            </div>
          </div>

          {gaps.map(gap => (
            <div key={gap.id} className="glass-panel p-5 hover:border-primary-500/30 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-gray-200 font-medium">{gap.description}</p>
                    {gap.suggested_topic && (
                      <p className="text-sm text-gray-400 mt-2">
                        💡 Suggested: Study <span className="text-primary-400 font-medium">{gap.suggested_topic}</span>
                      </p>
                    )}
                  </div>
                </div>
                {gap.suggested_topic && (
                  <Link to="/topics" className="secondary-btn flex items-center gap-1 text-xs shrink-0">
                    Study <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
