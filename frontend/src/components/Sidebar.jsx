import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, BookOpen, FileText, Brain, Target, BarChart3, LogOut, Search, Layers, StickyNote, Settings, Users } from 'lucide-react';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/classrooms', icon: Users, label: 'Classrooms' },
  { path: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/topics', icon: BookOpen, label: 'Topics' },
  { path: '/documents', icon: FileText, label: 'Documents' },
  { path: '/notes', icon: StickyNote, label: 'Notes' },
  { path: '/flashcards', icon: Layers, label: 'Flashcards' },
  { path: '/quiz', icon: Brain, label: 'Quiz' },
  { path: '/gaps', icon: Target, label: 'Knowledge Gaps' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ onLogout }) {
  const location = useLocation();

  return (
    <nav className="w-64 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800 flex flex-col p-4 z-10 shrink-0">
      <div className="flex items-center gap-3 px-2 mb-8 mt-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-wide">NeuroBase</span>
      </div>

      <div className="space-y-1 flex-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-primary-600/20 text-primary-400 shadow-lg shadow-primary-500/5'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
              <span className="font-medium text-sm">{label}</span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={onLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 mt-auto"
      >
        <LogOut className="w-5 h-5" />
        <span className="font-medium text-sm">Sign Out</span>
      </button>
    </nav>
  );
}
