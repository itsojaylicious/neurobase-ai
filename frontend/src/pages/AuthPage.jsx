import { useState } from 'react';
import { Brain, Loader2, Sparkles, BookOpen, Search } from 'lucide-react';
import api from '../api/client';

export default function AuthPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!isLogin) {
        await api.post('/auth/signup', { email, password });
      }
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.access_token);
      onLogin(res.data.access_token);
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary-950 via-gray-900 to-gray-950 items-center justify-center p-12">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-500/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-[120px]"></div>

        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-2xl shadow-primary-500/30">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white font-display">NeuroBase AI</h1>
              <p className="text-primary-300 text-lg">Your AI-Powered Second Brain</p>
            </div>
          </div>

          <div className="space-y-4 mt-12">
            {[
              { icon: Sparkles, title: 'AI-Powered Learning', desc: 'Generate structured courses on any topic instantly' },
              { icon: Search, title: 'Universal Search', desc: 'Ask anything — AI searches across all your knowledge' },
              { icon: BookOpen, title: 'Adaptive Quizzes', desc: 'Smart quizzes that adapt to your knowledge level' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex items-start gap-4 glass-panel p-4">
                <div className="w-10 h-10 rounded-lg bg-primary-600/30 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{title}</h3>
                  <p className="text-gray-400 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-950">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-xl shadow-primary-500/30">
              <Brain className="w-7 h-7 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center mb-2 text-white font-display">
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h2>
          <p className="text-gray-400 text-center mb-8">
            {isLogin ? 'Sign in to your second brain' : 'Create your AI-powered learning space'}
          </p>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl mb-6 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Password</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                required
              />
            </div>
            <button id="auth-submit" type="submit" disabled={loading} className="primary-btn w-full mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-primary-400 text-sm hover:text-primary-300 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
