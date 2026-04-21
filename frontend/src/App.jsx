import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import TopicsPage from './pages/TopicsPage';
import TopicDetailPage from './pages/TopicDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import QuizPage from './pages/QuizPage';
import GapsPage from './pages/GapsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import FlashcardsPage from './pages/FlashcardsPage';
import SearchPage from './pages/SearchPage';
import NotesPage from './pages/NotesPage';
import SettingsPage from './pages/SettingsPage';
import ClassroomsPage from './pages/ClassroomsPage';
import LiveClassPage from './pages/LiveClassPage';
import LectureReviewPage from './pages/LectureReviewPage';
import ClassAnalyticsPage from './pages/ClassAnalyticsPage';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Apply saved theme immediately on startup
  useState(() => {
    const theme = localStorage.getItem('nb_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  });

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/classrooms" element={<ClassroomsPage />} />
          <Route path="/classrooms/live/:id" element={<LiveClassPage />} />
          <Route path="/classrooms/review/:id" element={<LectureReviewPage />} />
          <Route path="/classrooms/analytics/:id" element={<ClassAnalyticsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:id" element={<TopicDetailPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/flashcards" element={<FlashcardsPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/gaps" element={<GapsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
