import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Brain, Loader2, CheckCircle, XCircle, Trophy, ArrowLeft, BookOpen } from 'lucide-react';
import api from '../api/client';

export default function QuizPage() {
  const [searchParams] = useSearchParams();
  const topicIdParam = searchParams.get('topic');

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);

  useEffect(() => {
    api.get('/topic/')
      .then(res => {
        const t = res.data.topics || [];
        setTopics(t);
        if (topicIdParam) {
          const target = t.find(x => x.id === parseInt(topicIdParam));
          if (target) loadQuiz(target);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const loadQuiz = async (topic) => {
    setSelectedTopic(topic);
    setQuizLoading(true);
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    try {
      const res = await api.post('/quiz/generate', { topic_id: topic.id });
      setQuiz(res.data.quiz);
    } catch (e) {
      alert('Failed to generate quiz.');
    }
    setQuizLoading(false);
  };

  const handleSubmit = async () => {
    if (!quiz?.questions) return;

    let correct = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correct_answer_index) correct++;
    });

    setScore(correct);
    setSubmitted(true);

    try {
      await api.post('/quiz/submit', {
        topic_id: selectedTopic.id,
        score: correct,
        total_questions: quiz.questions.length
      });
    } catch (e) {
      console.error('Failed to submit score', e);
    }
  };

  const resetQuiz = () => {
    setSelectedTopic(null);
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  // ── Quiz Taking View ──
  if (selectedTopic && quiz) {
    const total = quiz.questions?.length || 0;
    const allAnswered = Object.keys(answers).length === total;

    return (
      <div className="animate-slide-up space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={resetQuiz} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Quiz: {selectedTopic.title}</h1>
            <p className="text-gray-400 text-sm">{total} questions</p>
          </div>
        </div>

        {submitted && (
          <div className={`glass-panel p-6 text-center animate-fade-in ${
            score / total >= 0.8 ? 'border-emerald-500/30' : score / total >= 0.5 ? 'border-amber-500/30' : 'border-red-500/30'
          }`}>
            <Trophy className={`w-12 h-12 mx-auto mb-3 ${
              score / total >= 0.8 ? 'text-emerald-400' : score / total >= 0.5 ? 'text-amber-400' : 'text-red-400'
            }`} />
            <h2 className="text-2xl font-bold text-white">Score: {score}/{total}</h2>
            <p className="text-gray-400 mt-1">
              {score / total >= 0.8 ? 'Excellent! You have a strong understanding!' :
               score / total >= 0.5 ? 'Good effort! Keep studying to improve.' :
               'Needs improvement. Review the material and try again.'}
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <button onClick={() => loadQuiz(selectedTopic)} className="secondary-btn">Try Again</button>
              <button onClick={resetQuiz} className="primary-btn">Back to Topics</button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {quiz.questions?.map((q, qi) => (
            <div key={qi} className={`glass-panel p-5 transition-all ${
              submitted
                ? answers[qi] === q.correct_answer_index
                  ? 'border-emerald-500/30'
                  : answers[qi] !== undefined ? 'border-red-500/30' : ''
                : ''
            }`}>
              <p className="font-medium text-gray-200 mb-4">
                <span className="text-primary-400 mr-2">Q{qi + 1}.</span>
                {q.text}
              </p>
              <div className="space-y-2">
                {q.options?.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
                    disabled={submitted}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                      submitted
                        ? oi === q.correct_answer_index
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : answers[qi] === oi
                            ? 'border-red-500/50 bg-red-500/10 text-red-300'
                            : 'border-gray-700/50 bg-gray-800/30 text-gray-500'
                        : answers[qi] === oi
                          ? 'border-primary-500/50 bg-primary-500/10 text-primary-300'
                          : 'border-gray-700/50 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {submitted && oi === q.correct_answer_index && <CheckCircle className="w-4 h-4 ml-auto text-emerald-400 shrink-0" />}
                      {submitted && answers[qi] === oi && oi !== q.correct_answer_index && <XCircle className="w-4 h-4 ml-auto text-red-400 shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
              {submitted && q.explanation && (
                <p className="mt-3 text-xs text-gray-400 bg-gray-800/50 p-3 rounded-lg border border-gray-700/30">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>

        {!submitted && (
          <button
            id="quiz-submit"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`primary-btn w-full ${!allAnswered ? 'opacity-50' : ''}`}
          >
            Submit Quiz ({Object.keys(answers).length}/{total} answered)
          </button>
        )}
      </div>
    );
  }

  // ── Quiz Loading ──
  if (quizLoading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
      <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      <p className="text-gray-400">Generating quiz questions with AI...</p>
    </div>
  );

  // ── Topic Selection View ──
  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Quiz Center</h1>
        <p className="text-gray-400 mt-1">Select a topic to test your knowledge</p>
      </div>

      {topics.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">No topics available. Generate a topic first to take quizzes!</p>
          <Link to="/topics" className="primary-btn inline-flex">
            <BookOpen className="w-5 h-5 mr-2" /> Go to Topics
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map(topic => (
            <button
              key={topic.id}
              onClick={() => loadQuiz(topic)}
              className="glass-panel p-5 text-left hover:border-primary-500/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white group-hover:text-primary-300 transition-colors">{topic.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      topic.status === 'Strong' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      topic.status === 'Medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      topic.status === 'Weak' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-gray-600/20 text-gray-400 border-gray-600/30'
                    }`}>{topic.status}</span>
                    <span className="text-xs text-gray-500">{topic.subtopic_count} subtopics</span>
                  </div>
                </div>
                <Brain className="w-6 h-6 text-gray-600 group-hover:text-primary-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
