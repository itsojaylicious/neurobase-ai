import { useState, useEffect } from 'react';
import { Settings, Loader2, User, Palette, Key, Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../api/client';

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [learningStyle, setLearningStyle] = useState('balanced');
  const [role, setRole] = useState('student');

  // Theme
  const [theme, setTheme] = useState('dark');

  // API Key
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get('/settings/profile');
      setProfile(res.data);
      setDisplayName(res.data.display_name || '');
      setLearningStyle(res.data.learning_style || 'balanced');
      setRole(res.data.role || 'student');
      const savedTheme = res.data.theme || localStorage.getItem('nb_theme') || 'dark';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving('profile');
    try {
      await api.put('/settings/profile', {
        display_name: displayName,
        learning_style: learningStyle,
        role: role
      });
      showMessage('success', 'Profile updated successfully. Refresh if you changed your role.');
    } catch (e) {
      showMessage('error', e.response?.data?.message || 'Failed to update profile');
    }
    setSaving('');
  };

  const handleSaveTheme = async (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('nb_theme', newTheme);
    setSaving('theme');
    try {
      await api.put('/settings/profile', { theme: newTheme });
      showMessage('success', `Theme changed to ${newTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}`);
    } catch (e) {
      showMessage('error', 'Failed to update theme');
    }
    setSaving('');
  };

  const handleSaveApiKey = async () => {
    setSaving('apikey');
    try {
      await api.put('/settings/profile', { gemini_api_key: apiKey });
      showMessage('success', 'API key updated');
      setApiKey('');
      await loadProfile();
    } catch (e) {
      showMessage('error', 'Failed to update API key');
    }
    setSaving('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 6) {
      showMessage('error', 'New password must be at least 6 characters');
      return;
    }
    setSaving('password');
    try {
      await api.put('/settings/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      showMessage('success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e) {
      showMessage('error', e.response?.data?.message || 'Failed to change password');
    }
    setSaving('');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  const learningStyles = [
    { value: 'visual', label: '🎨 Visual', desc: 'Diagrams, charts, and visual aids' },
    { value: 'reading', label: '📖 Reading', desc: 'Detailed text-based learning' },
    { value: 'practice', label: '🔧 Practice', desc: 'Hands-on exercises and quizzes' },
    { value: 'balanced', label: '⚖️ Balanced', desc: 'Mix of all learning styles' },
  ];

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your profile, preferences, and API configuration</p>
      </div>

      {/* Status Message */}
      {message.text && (
        <div className={`p-4 rounded-xl border animate-fade-in flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Email</label>
            <input type="text" value={profile?.email || ''} disabled className="input-field opacity-60" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Account Role (Testing Toggle)</label>
            <select 
               value={role} 
               onChange={e => setRole(e.target.value)} 
               className="input-field py-3 text-sm bg-gray-800"
            >
              <option value="student">Student (Student view)</option>
              <option value="teacher">Teacher (Class creation, go live)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Simulate the app experience as either a Student or Teacher.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">Learning Style</label>
            <div className="grid grid-cols-2 gap-3">
              {learningStyles.map(style => (
                <button
                  key={style.value}
                  onClick={() => setLearningStyle(style.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    learningStyle === style.value
                      ? 'bg-primary-600/20 border-primary-500/50 text-primary-300'
                      : 'bg-gray-800/30 border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="font-medium text-sm">{style.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSaveProfile} disabled={saving === 'profile'} className="primary-btn text-sm">
            {saving === 'profile' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Theme Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <Palette className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Appearance</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => handleSaveTheme('dark')}
            className={`p-4 rounded-xl border text-center transition-all ${
              theme === 'dark'
                ? 'bg-primary-600/20 border-primary-500/50'
                : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="w-full h-16 rounded-lg bg-gray-900 border border-gray-700 mb-3 flex items-center justify-center">
              <span className="text-xs text-gray-400">Dark Mode</span>
            </div>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-primary-400' : 'text-gray-400'}`}>🌙 Dark</p>
          </button>
          <button
            onClick={() => handleSaveTheme('light')}
            className={`p-4 rounded-xl border text-center transition-all ${
              theme === 'light'
                ? 'bg-primary-600/20 border-primary-500/50'
                : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="w-full h-16 rounded-lg bg-gray-100 border border-gray-300 mb-3 flex items-center justify-center">
              <span className="text-xs text-gray-600">Light Mode</span>
            </div>
            <p className={`text-sm font-medium ${theme === 'light' ? 'text-primary-400' : 'text-gray-400'}`}>☀️ Light</p>
          </button>
        </div>
      </div>

      {/* API Key Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <Key className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">AI Configuration</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Configure your Google Gemini API key for AI features. {profile?.has_api_key && (
            <span className="text-emerald-400 font-medium">✓ Key is set</span>
          )}
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={profile?.has_api_key ? '••••••••••••••••' : 'Enter your Gemini API key'}
              className="input-field pr-10"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={handleSaveApiKey} disabled={saving === 'apikey' || !apiKey} className="primary-btn text-sm">
            {saving === 'apikey' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Key'}
          </button>
        </div>
      </div>

      {/* Password Section */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-white font-display">Security</h2>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="input-field"
          />
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="input-field"
          />
          <button
            onClick={handleChangePassword}
            disabled={saving === 'password' || !currentPassword || !newPassword}
            className="primary-btn text-sm"
          >
            {saving === 'password' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white mb-4 font-display">Account Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Account created</span>
            <span className="text-gray-300">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Email</span>
            <span className="text-gray-300">{profile?.email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
