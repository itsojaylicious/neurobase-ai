"""
Notes API — Create, edit, and manage personal notes with AI enhancement.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Note, Topic
from app.services.ai import get_gemini_response

router = APIRouter()


class NoteCreateRequest(BaseModel):
    title: str
    content: str = ""
    topic_id: Optional[int] = None


class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    topic_id: Optional[int] = None
    is_pinned: Optional[bool] = None


class NoteAIRequest(BaseModel):
    action: str  # "expand", "summarize", "simplify", "bullets"


@router.post("/")
def create_note(
    req: NoteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new note."""
    note = Note(
        user_id=current_user.id,
        title=req.title,
        content=req.content,
        topic_id=req.topic_id
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_dict(note, db)


@router.get("/")
def get_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notes for the current user."""
    notes = (
        db.query(Note)
        .filter(Note.user_id == current_user.id)
        .order_by(Note.is_pinned.desc(), Note.updated_at.desc())
        .all()
    )
    return {"notes": [_note_to_dict(n, db) for n in notes]}


@router.get("/{note_id}")
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return _note_to_dict(note, db)


@router.put("/{note_id}")
def update_note(
    note_id: int,
    req: NoteUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if req.title is not None:
        note.title = req.title
    if req.content is not None:
        note.content = req.content
    if req.topic_id is not None:
        note.topic_id = req.topic_id
    if req.is_pinned is not None:
        note.is_pinned = req.is_pinned

    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return _note_to_dict(note, db)


@router.delete("/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}


@router.post("/{note_id}/ai-enhance")
def ai_enhance_note(
    note_id: int,
    req: NoteAIRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """AI-enhance a note: expand, summarize, simplify, or convert to bullets."""
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if not note.content or not note.content.strip():
        raise HTTPException(status_code=400, detail="Note has no content to enhance")

    action_prompts = {
        "expand": f"""Expand and enrich these notes with more detail, examples, and explanations. Keep the same structure but add depth:\n\n{note.content}""",
        "summarize": f"""Summarize these notes into a concise overview. Keep the key points and important details:\n\n{note.content}""",
        "simplify": f"""Simplify these notes for a beginner. Use simple language, analogies, and clear explanations:\n\n{note.content}""",
        "bullets": f"""Convert these notes into well-organized bullet points with clear hierarchy. Use markdown formatting:\n\n{note.content}""",
    }

    prompt = action_prompts.get(req.action)
    if not prompt:
        raise HTTPException(status_code=400, detail=f"Invalid action: {req.action}. Use: expand, summarize, simplify, bullets")

    enhanced = get_gemini_response(prompt)
    note.content = enhanced
    note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return _note_to_dict(note, db)


def _note_to_dict(note: Note, db: Session) -> dict:
    topic_info = None
    if note.topic_id:
        topic = db.query(Topic).filter(Topic.id == note.topic_id).first()
        if topic:
            topic_info = {"id": topic.id, "title": topic.title}
    return {
        "id": note.id,
        "title": note.title,
        "content": note.content,
        "is_pinned": note.is_pinned,
        "topic": topic_info,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None
    }
