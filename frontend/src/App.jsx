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

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

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
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:id" element={<TopicDetailPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/gaps" element={<GapsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
