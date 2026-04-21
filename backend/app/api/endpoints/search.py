"""
Universal Search API — Semantic search across documents, notes, chat, and flashcards.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Chunk, Subtopic, Topic, ChatMessage, Document, Flashcard, Note
from app.services.ai.rag import tokenize, search_relevant_chunks, _VirtualChunk

router = APIRouter()


class _SearchableItem:
    """Wrapper for search across different content types."""
    def __init__(self, text, source_type, source_id, title="", extra=None):
        self.text = text
        self.source_type = source_type
        self.source_id = source_id
        self.title = title
        self.extra = extra or {}


@router.get("/")
def universal_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search across all user data: documents, notes, chat history, flashcards."""
    results = {"documents": [], "notes": [], "chats": [], "flashcards": [], "topics": []}

    query_lower = q.lower()
    query_tokens = set(tokenize(q))

    # ── Search Documents (chunks) ──
    user_chunks = db.query(Chunk).filter(Chunk.user_id == current_user.id).all()
    if user_chunks:
        virtual = [_VirtualChunk(c.text) for c in user_chunks]
        relevant = search_relevant_chunks(q, virtual, top_k=5)
        for vc in relevant:
            # Find the document this chunk belongs to
            for chunk in user_chunks:
                if chunk.text == vc.text:
                    doc = db.query(Document).filter(Document.id == chunk.document_id).first()
                    results["documents"].append({
                        "id": chunk.document_id,
                        "title": doc.title if doc else "Unknown",
                        "snippet": vc.text[:200] + "..." if len(vc.text) > 200 else vc.text,
                        "source_type": doc.source_type if doc else "unknown"
                    })
                    break

    # Deduplicate documents by id
    seen_doc_ids = set()
    deduped_docs = []
    for d in results["documents"]:
        if d["id"] not in seen_doc_ids:
            seen_doc_ids.add(d["id"])
            deduped_docs.append(d)
    results["documents"] = deduped_docs[:5]

    # ── Search Topics & Subtopics (generated notes) ──
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    for topic in topics:
        if _text_matches(topic.title, query_lower, query_tokens):
            results["topics"].append({
                "id": topic.id,
                "title": topic.title,
                "status": topic.status,
                "type": "topic"
            })

        subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic.id, Subtopic.content.isnot(None)).all()
        for sub in subtopics:
            if _text_matches(sub.title, query_lower, query_tokens) or _text_matches(sub.content or "", query_lower, query_tokens):
                snippet = (sub.content or "")[:200]
                results["notes"].append({
                    "id": sub.id,
                    "title": f"{topic.title} → {sub.title}",
                    "snippet": snippet + "..." if len(sub.content or "") > 200 else snippet,
                    "topic_id": topic.id,
                    "type": "subtopic"
                })

    results["topics"] = results["topics"][:5]
    results["notes"] = results["notes"][:5]

    # ── Search User Notes ──
    user_notes = db.query(Note).filter(Note.user_id == current_user.id).all()
    for note in user_notes:
        if _text_matches(note.title, query_lower, query_tokens) or _text_matches(note.content or "", query_lower, query_tokens):
            snippet = (note.content or "")[:200]
            results["notes"].append({
                "id": note.id,
                "title": note.title,
                "snippet": snippet + "..." if len(note.content or "") > 200 else snippet,
                "topic_id": note.topic_id,
                "type": "note"
            })

    # ── Search Chat History ──
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).order_by(ChatMessage.created_at.desc()).limit(200).all()
    for msg in messages:
        if _text_matches(msg.content, query_lower, query_tokens):
            results["chats"].append({
                "id": msg.id,
                "role": msg.role,
                "snippet": msg.content[:200] + "..." if len(msg.content) > 200 else msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            })
    results["chats"] = results["chats"][:5]

    # ── Search Flashcards ──
    flashcards = db.query(Flashcard).filter(Flashcard.user_id == current_user.id).all()
    for fc in flashcards:
        if _text_matches(fc.front, query_lower, query_tokens) or _text_matches(fc.back, query_lower, query_tokens):
            results["flashcards"].append({
                "id": fc.id,
                "front": fc.front,
                "back": fc.back[:150] + "..." if len(fc.back) > 150 else fc.back,
                "difficulty": fc.difficulty
            })
    results["flashcards"] = results["flashcards"][:5]

    # Total count
    total = sum(len(v) for v in results.values())
    return {"query": q, "total_results": total, "results": results}


def _text_matches(text: str, query_lower: str, query_tokens: set) -> bool:
    """Check if text matches query via substring or token overlap."""
    if not text:
        return False
    text_lower = text.lower()
    # Direct substring match
    if query_lower in text_lower:
        return True
    # Token overlap (at least 60% of query tokens present)
    if query_tokens:
        text_tokens = set(tokenize(text))
        overlap = len(query_tokens & text_tokens)
        if overlap / len(query_tokens) >= 0.6:
            return True
    return False
