import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Loader2, FileText, BookOpen, MessageSquare, Layers, X, ArrowRight, Hash } from 'lucide-react';
import api from '../api/client';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setTotalResults(0);
      return;
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const performSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await api.get('/search/', { params: { q } });
      setResults(res.data.results);
      setTotalResults(res.data.total_results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const tabs = [
    { key: 'all', label: 'All', count: totalResults },
    { key: 'topics', label: 'Topics', icon: Hash, count: results?.topics?.length || 0 },
    { key: 'documents', label: 'Documents', icon: FileText, count: results?.documents?.length || 0 },
    { key: 'notes', label: 'Notes', icon: BookOpen, count: results?.notes?.length || 0 },
    { key: 'chats', label: 'Chats', icon: MessageSquare, count: results?.chats?.length || 0 },
    { key: 'flashcards', label: 'Flashcards', icon: Layers, count: results?.flashcards?.length || 0 },
  ];

  const getFilteredResults = () => {
    if (!results) return {};
    if (activeTab === 'all') return results;
    return { [activeTab]: results[activeTab] || [] };
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Search</h1>
        <p className="text-gray-400 mt-1">Search across your entire knowledge base</p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          id="search-input"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search documents, notes, chats, flashcards..."
          className="input-field pl-12 pr-12 text-lg py-4"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
        {loading && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary-500" />}
      </div>

      {/* Tabs */}
      {results && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-400 hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-primary-500/30 text-primary-300' : 'bg-gray-700/50 text-gray-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {!results && !loading && (
        <div className="glass-panel p-16 text-center">
          <SearchIcon className="w-14 h-14 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Search your Second Brain</p>
          <p className="text-gray-500 text-sm mt-1">Find anything across documents, notes, chat history, and flashcards</p>
        </div>
      )}

      {results && totalResults === 0 && (
        <div className="glass-panel p-12 text-center">
          <SearchIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No results found for "{query}"</p>
          <p className="text-gray-500 text-sm mt-1">Try different keywords or upload more content</p>
        </div>
      )}

      {results && totalResults > 0 && (
        <div className="space-y-6">
          {/* Topics */}
          {filteredResults.topics?.length > 0 && (
            <ResultSection title="Topics" icon={Hash} color="text-primary-400">
              {filteredResults.topics.map(topic => (
                <Link key={topic.id} to={`/topics/${topic.id}`} className="block p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-primary-500/30 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Hash className="w-4 h-4 text-primary-400 shrink-0" />
                      <span className="font-medium text-gray-200 group-hover:text-white">{topic.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        topic.status === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' :
                        topic.status === 'Weak' ? 'bg-red-500/20 text-red-400' :
                        topic.status === 'Medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-gray-600/20 text-gray-400'
                      }`}>{topic.status}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-primary-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Documents */}
          {filteredResults.documents?.length > 0 && (
            <ResultSection title="Documents" icon={FileText} color="text-red-400">
              {filteredResults.documents.map((doc, i) => (
                <Link key={i} to="/documents" className="block p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-red-500/30 transition-all group">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 group-hover:text-white">{doc.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.snippet}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Notes */}
          {filteredResults.notes?.length > 0 && (
            <ResultSection title="Notes" icon={BookOpen} color="text-blue-400">
              {filteredResults.notes.map((note, i) => (
                <Link
                  key={i}
                  to={note.type === 'subtopic' ? `/topics/${note.topic_id}` : '/notes'}
                  className="block p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-blue-500/30 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 group-hover:text-white">{note.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{note.snippet}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Chats */}
          {filteredResults.chats?.length > 0 && (
            <ResultSection title="Chat History" icon={MessageSquare} color="text-purple-400">
              {filteredResults.chats.map((msg, i) => (
                <Link key={i} to="/chat" className="block p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-purple-500/30 transition-all group">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 mb-1">{msg.role === 'user' ? 'You' : 'AI'} • {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : ''}</p>
                      <p className="text-sm text-gray-300 line-clamp-2">{msg.snippet}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}

          {/* Flashcards */}
          {filteredResults.flashcards?.length > 0 && (
            <ResultSection title="Flashcards" icon={Layers} color="text-amber-400">
              {filteredResults.flashcards.map((fc, i) => (
                <Link key={i} to="/flashcards" className="block p-4 bg-gray-800/40 rounded-xl border border-gray-700/30 hover:border-amber-500/30 transition-all group">
                  <div className="flex items-start gap-3">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-200 group-hover:text-white text-sm">{fc.front}</p>
                      <p className="text-xs text-gray-500 mt-1">{fc.back}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, icon: Icon, color, children }) {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2 uppercase tracking-wider">
        <Icon className={`w-4 h-4 ${color}`} /> {title}
      </h2>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
