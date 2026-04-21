import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Brain, HelpCircle, MessageSquare, CheckCircle, XCircle, Award, Loader2, Send, Search } from 'lucide-react';
import api from '../api/client';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function LectureReviewPage() {
  const { id: lectureId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');

  // Quiz state
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quizDone, setQuizDone] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  // Ask AI state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswers, setAiAnswers] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Transcript search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadReview();
  }, [lectureId]);

  const loadReview = async () => {
    try {
      const res = await api.get(`/lectures/${lectureId}/review`);
      setReview(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load lecture review");
    }
    setLoading(false);
  };

  // ═══ QUIZ LOGIC ═══
  const quiz = review?.auto_quiz || [];

  const handleAnswer = (idx) => {
    setSelectedAnswer(idx);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    const isCorrect = selectedAnswer === quiz[currentQ]?.correct;
    const newAnswers = [...answers, { question: currentQ, selected: selectedAnswer, correct: isCorrect }];
    setAnswers(newAnswers);

    if (currentQ + 1 >= quiz.length) {
      const score = newAnswers.filter(a => a.correct).length;
      setQuizScore(score);
      setQuizDone(true);
      // Submit to backend
      api.post(`/lectures/${lectureId}/submit-quiz`, {
        score,
        total_questions: quiz.length
      }).catch(e => console.error(e));
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQ(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setQuizDone(false);
    setQuizScore(0);
    setShowExplanation(false);
  };

  // ═══ ASK AI ═══
  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    const q = aiQuestion.trim();
    setAiQuestion('');
    setAiLoading(true);
    setAiAnswers(prev => [...prev, { type: 'question', text: q }]);

    try {
      const res = await api.post(`/lectures/${lectureId}/ask-ai`, { question: q });
      setAiAnswers(prev => [...prev, { type: 'answer', text: res.data.answer }]);
    } catch (e) {
      setAiAnswers(prev => [...prev, { type: 'answer', text: 'Failed to get answer.' }]);
    }
    setAiLoading(false);
  };

  // ═══ TRANSCRIPT SEARCH ═══
  const highlightText = (text, term) => {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-500/40 text-yellow-200 rounded px-0.5">$1</mark>');
  };


  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (!review) return <div className="text-center text-gray-500 mt-20">Lecture not found</div>;

  const tabs = [
    { key: 'notes', icon: Brain, label: 'AI Notes' },
    { key: 'transcript', icon: FileText, label: 'Transcript' },
    { key: 'quiz', icon: HelpCircle, label: `Quiz (${quiz.length})` },
    { key: 'ask', icon: MessageSquare, label: 'Ask AI' },
  ];

  return (
    <div className="animate-slide-up flex flex-col h-full gap-4" style={{ maxHeight: 'calc(100vh - 80px)' }}>

      {/* Header */}
      <div className="glass-panel p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/classrooms/live/${review.classroom_id}`)} className="p-2 hover:bg-gray-800 rounded-xl transition">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{review.title}</h1>
            <p className="text-xs text-gray-500">
              {review.classroom_name} •
              {review.started_at ? ` ${new Date(review.started_at).toLocaleDateString()} ${new Date(review.started_at).toLocaleTimeString()}` : ''} •
              {review.detected_topics?.length > 0 && (
                <span className="ml-1">
                  {review.detected_topics.map((t, i) => (
                    <span key={i} className="inline-block text-xs bg-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 mr-1">{t}</span>
                  ))}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 shrink-0 glass-panel p-1">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition ${
              activeTab === tab.key
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto glass-panel p-6">

        {/* ═══ AI NOTES TAB ═══ */}
        {activeTab === 'notes' && (
          <div>
            {review.summary ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={review.summary} />
              </div>
            ) : (
              <p className="text-gray-500 text-center mt-10">No AI notes generated for this lecture.</p>
            )}
          </div>
        )}

        {/* ═══ TRANSCRIPT TAB ═══ */}
        {activeTab === 'transcript' && (
          <div>
            <div className="mb-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
              <input
                type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search transcript..."
                className="input-field pl-10 text-sm"
              />
            </div>
            {review.transcript ? (
              <div className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: highlightText(review.transcript, searchTerm) }}
              />
            ) : (
              <p className="text-gray-500 text-center mt-10">No transcript available.</p>
            )}
          </div>
        )}

        {/* ═══ QUIZ TAB ═══ */}
        {activeTab === 'quiz' && (
          <div className="max-w-2xl mx-auto">
            {quiz.length === 0 ? (
              <p className="text-gray-500 text-center mt-10">No quiz available for this lecture.</p>
            ) : quizDone ? (
              <div className="text-center space-y-6">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center text-3xl font-bold ${
                  quizScore / quiz.length >= 0.7 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {quizScore}/{quiz.length}
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {quizScore / quiz.length >= 0.7 ? '🎉 Great Job!' : '📚 Keep Studying!'}
                </h2>
                <p className="text-gray-400">
                  You scored {Math.round((quizScore / quiz.length) * 100)}% on this lecture quiz.
                  {quizScore / quiz.length < 0.6 && ' Weak areas have been added to your knowledge gaps.'}
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={resetQuiz} className="primary-btn">Try Again</button>
                  <button onClick={() => setActiveTab('notes')} className="primary-btn bg-purple-600 border-purple-500">Review Notes</button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Question {currentQ + 1} of {quiz.length}</span>
                  <div className="flex gap-1">
                    {quiz.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${
                        i < currentQ ? (answers[i]?.correct ? 'bg-emerald-400' : 'bg-red-400') :
                        i === currentQ ? 'bg-primary-400' : 'bg-gray-700'
                      }`} />
                    ))}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-white">{quiz[currentQ]?.question}</h3>

                <div className="space-y-3">
                  {quiz[currentQ]?.options?.map((opt, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrect = idx === quiz[currentQ]?.correct;
                    const showResult = showExplanation;

                    let btnClass = 'p-4 rounded-xl border text-left text-sm transition cursor-pointer ';
                    if (showResult && isCorrect) {
                      btnClass += 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300';
                    } else if (showResult && isSelected && !isCorrect) {
                      btnClass += 'bg-red-500/10 border-red-500/50 text-red-300';
                    } else if (isSelected) {
                      btnClass += 'bg-primary-500/10 border-primary-500/50 text-primary-300';
                    } else {
                      btnClass += 'bg-gray-800/40 border-gray-700/50 text-gray-300 hover:border-gray-600';
                    }

                    return (
                      <button key={idx} onClick={() => !showExplanation && handleAnswer(idx)} className={btnClass + ' w-full flex items-center gap-3'}>
                        {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
                        {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                        {!showResult && <span className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center text-xs shrink-0">{String.fromCharCode(65 + idx)}</span>}
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {showExplanation && quiz[currentQ]?.explanation && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-300">
                    💡 {quiz[currentQ].explanation}
                  </div>
                )}

                {showExplanation && (
                  <button onClick={nextQuestion} className="primary-btn w-full justify-center">
                    {currentQ + 1 >= quiz.length ? 'See Results' : 'Next Question →'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ ASK AI TAB ═══ */}
        {activeTab === 'ask' && (
          <div className="flex flex-col h-full max-w-2xl mx-auto" style={{ minHeight: '400px' }}>
            <p className="text-xs text-gray-400 mb-4">Ask questions about this specific lecture. The AI will answer using only the lecture transcript and notes.</p>

            <div className="flex-1 space-y-4 overflow-y-auto mb-4">
              {aiAnswers.map((msg, i) => (
                <div key={i} className={`p-4 rounded-xl text-sm ${
                  msg.type === 'question'
                    ? 'bg-gray-800/50 text-gray-300 ml-8'
                    : 'bg-purple-500/10 border border-purple-500/20 text-purple-200 mr-8'
                }`}>
                  <span className="font-semibold">{msg.type === 'question' ? '🧑‍🎓 You' : '🤖 AI Tutor'}:</span>
                  <div className="mt-1 whitespace-pre-wrap">{msg.text}</div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <input
                type="text" value={aiQuestion} onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                placeholder="e.g., What did the teacher say about normalization?"
                className="input-field text-sm py-3 flex-1"
              />
              <button onClick={handleAskAI} disabled={aiLoading} className="primary-btn bg-purple-600 border-purple-500 px-5">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
