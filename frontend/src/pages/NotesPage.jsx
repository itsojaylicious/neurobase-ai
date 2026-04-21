import { useState, useEffect } from 'react';
import { StickyNote, Plus, Loader2, Trash2, Pin, PinOff, Sparkles, ChevronDown, Edit3, Eye, Save, X, BookOpen } from 'lucide-react';
import api from '../api/client';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function NotesPage() {
  const [notes, setNotes] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [notesRes, topicsRes] = await Promise.all([
        api.get('/notes'),
        api.get('/topics')
      ]);
      setNotes(notesRes.data || []);
      setTopics(topicsRes.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const openNewNote = () => {
    setEditingNote(null);
    setTitle('');
    setContent('');
    setSelectedTopic('');
    setPreviewMode(false);
    setShowEditor(true);
  };

  const openEditNote = (note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content || '');
    setSelectedTopic(note.topic?.id?.toString() || '');
    setPreviewMode(false);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        content,
        topic_id: selectedTopic ? parseInt(selectedTopic) : null
      };

      if (editingNote) {
        await api.put(`/notes/${editingNote._id || editingNote.id}`, payload);
      } else {
        await api.post('/notes', payload);
      }
      setShowEditor(false);
      await loadData();
    } catch (e) {
      alert('Failed to save note.');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes(notes.filter(n => (n._id || n.id)?.toString() !== id?.toString()));
      if ((editingNote?._id || editingNote?.id)?.toString() === id?.toString()) setShowEditor(false);
    } catch (e) {
      alert('Failed to delete note.');
    }
  };

  const handlePin = async (note) => {
    try {
      await api.put(`/notes/${note._id || note.id}`, { is_pinned: !note.isPinned });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAIEnhance = async (action) => {
    if (!editingNote) return;
    setEnhancing(true);
    try {
      const res = await api.post(`/notes/${editingNote._id || editingNote.id}/enhance`);
      setContent(res.data.content || content);
      setEditingNote({ ...editingNote, content: res.data.content });
    } catch (e) {
      alert('AI enhancement failed.');
    }
    setEnhancing(false);
  };

  const filteredNotes = notes.filter(n =>
    !searchFilter || n.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );

  // ── Editor View ──
  if (showEditor) {
    return (
      <div className="animate-slide-up space-y-4 h-full flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowEditor(false)} className="p-2 rounded-xl hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-xl font-bold font-display text-white">{editingNote ? 'Edit Note' : 'New Note'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {editingNote && (
              <div className="relative group">
                <button disabled={enhancing} className="secondary-btn flex items-center gap-1 text-xs">
                  {enhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Enhance
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  {['expand', 'summarize', 'simplify', 'bullets'].map(action => (
                    <button
                      key={action}
                      onClick={() => handleAIEnhance(action)}
                      disabled={enhancing}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors first:rounded-t-xl last:rounded-b-xl capitalize"
                    >
                      {action === 'bullets' ? 'Convert to Bullets' : action}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setPreviewMode(!previewMode)} className="secondary-btn text-xs flex items-center gap-1">
              {previewMode ? <><Edit3 className="w-3 h-3" /> Edit</> : <><Eye className="w-3 h-3" /> Preview</>}
            </button>
            <button onClick={handleSave} disabled={saving || !title.trim()} className="primary-btn text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Save</>}
            </button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Note title..."
          className="input-field text-xl font-semibold shrink-0"
        />

        <div className="flex items-center gap-3 shrink-0">
          <select
            value={selectedTopic}
            onChange={e => setSelectedTopic(e.target.value)}
            className="input-field text-sm py-2 w-auto min-w-[200px]"
          >
            <option value="">No linked topic</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        <div className="flex-1 min-h-0">
          {previewMode ? (
            <div className="glass-panel p-6 h-full overflow-y-auto">
              <MarkdownRenderer content={content || '*No content yet*'} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your notes here... (supports Markdown)"
              className="input-field h-full resize-none font-mono text-sm leading-relaxed"
            />
          )}
        </div>
      </div>
    );
  }

  // ── Notes List View ──
  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display bg-gradient-to-r from-primary-200 to-primary-400 bg-clip-text text-transparent">Notes</h1>
          <p className="text-gray-400 mt-1">Your personal notes — write, edit, and enhance with AI</p>
        </div>
        <button onClick={openNewNote} className="primary-btn">
          <Plus className="w-5 h-5 mr-2" /> New Note
        </button>
      </div>

      {/* Search/Filter */}
      {notes.length > 0 && (
        <input
          type="text"
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Filter notes..."
          className="input-field text-sm"
        />
      )}

      {filteredNotes.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <StickyNote className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">{searchFilter ? 'No notes match your filter' : 'No notes yet. Create your first one!'}</p>
          {!searchFilter && (
            <button onClick={openNewNote} className="primary-btn inline-flex">
              <Plus className="w-5 h-5 mr-2" /> Create Note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map(note => {
            const nid = note._id || note.id;
            return (
            <div key={nid} className="glass-panel p-5 group hover:border-primary-500/30 transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {(note.isPinned || note.is_pinned) && <Pin className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
                  <h3
                    className="font-semibold text-white truncate cursor-pointer hover:text-primary-300 transition-colors"
                    onClick={() => openEditNote(note)}
                  >{note.title}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handlePin(note)} className="p-1.5 text-gray-500 hover:text-primary-400 transition-colors">
                    {note.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => openEditNote(note)} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(nid)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {note.topic && (
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-3 h-3 text-primary-400" />
                  <span className="text-xs text-primary-400">{note.topic.title}</span>
                </div>
              )}

              <div
                className="text-sm text-gray-400 line-clamp-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === nid ? null : nid)}
              >
                {note.content ? (note.content.length > 150 ? note.content.substring(0, 150) + '...' : note.content) : 'Empty note'}
              </div>

              {expandedId === nid && note.content && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 animate-fade-in max-h-[300px] overflow-y-auto">
                  <MarkdownRenderer content={note.content} />
                </div>
              )}

              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>{note.updatedAt || note.updated_at ? new Date(note.updatedAt || note.updated_at).toLocaleDateString() : ''}</span>
                <span>{note.content ? note.content.split(/\s+/).length : 0} words</span>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
