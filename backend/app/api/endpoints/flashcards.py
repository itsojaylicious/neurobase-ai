"""
Flashcards API — Generate, review, and manage flashcards with spaced repetition.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Flashcard, Topic
from app.services.ai.flashcards import generate_flashcards_for_topic

router = APIRouter()


class FlashcardGenerateRequest(BaseModel):
    topic_id: int


class FlashcardReviewRequest(BaseModel):
    quality: int  # 0=Again, 1=Hard, 2=Good, 3=Easy


@router.post("/generate")
def generate_flashcards(
    req: FlashcardGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate flashcards for a topic using AI."""
    topic = db.query(Topic).filter(Topic.id == req.topic_id, Topic.user_id == current_user.id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    cards_data = generate_flashcards_for_topic(req.topic_id, current_user.id, db)

    created = []
    for card in cards_data:
        fc = Flashcard(
            user_id=current_user.id,
            topic_id=req.topic_id,
            front=card["front"],
            back=card["back"],
            difficulty=card.get("difficulty", "medium"),
            next_review=datetime.utcnow()
        )
        db.add(fc)
        created.append(fc)
    db.commit()
    for fc in created:
        db.refresh(fc)

    return {
        "message": f"Generated {len(created)} flashcards",
        "flashcards": [_flashcard_to_dict(fc) for fc in created]
    }


@router.get("/")
def get_flashcards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all flashcards for the current user."""
    cards = db.query(Flashcard).filter(Flashcard.user_id == current_user.id).order_by(Flashcard.created_at.desc()).all()
    return {"flashcards": [_flashcard_to_dict(fc) for fc in cards]}


@router.get("/due")
def get_due_flashcards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get flashcards due for review (spaced repetition)."""
    now = datetime.utcnow()
    cards = (
        db.query(Flashcard)
        .filter(Flashcard.user_id == current_user.id, Flashcard.next_review <= now)
        .order_by(Flashcard.next_review.asc())
        .all()
    )
    return {
        "due_count": len(cards),
        "flashcards": [_flashcard_to_dict(fc) for fc in cards]
    }


@router.get("/stats")
def get_flashcard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get flashcard statistics."""
    all_cards = db.query(Flashcard).filter(Flashcard.user_id == current_user.id).all()
    now = datetime.utcnow()
    due = sum(1 for c in all_cards if c.next_review <= now)
    mastered = sum(1 for c in all_cards if c.repetitions >= 5)
    learning = sum(1 for c in all_cards if 0 < c.repetitions < 5)
    new = sum(1 for c in all_cards if c.repetitions == 0)

    return {
        "total": len(all_cards),
        "due": due,
        "mastered": mastered,
        "learning": learning,
        "new": new
    }


@router.put("/{card_id}/review")
def review_flashcard(
    card_id: int,
    req: FlashcardReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Review a flashcard — SM-2 spaced repetition algorithm."""
    card = db.query(Flashcard).filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    quality = max(0, min(3, req.quality))

    # SM-2 algorithm (simplified)
    if quality == 0:  # Again
        card.repetitions = 0
        card.interval = 0
        card.next_review = datetime.utcnow() + timedelta(minutes=10)
    elif quality == 1:  # Hard
        card.interval = max(1, int(card.interval * 1.2))
        card.ease_factor = max(1.3, card.ease_factor - 0.15)
        card.next_review = datetime.utcnow() + timedelta(days=card.interval)
    elif quality == 2:  # Good
        if card.repetitions == 0:
            card.interval = 1
        elif card.repetitions == 1:
            card.interval = 3
        else:
            card.interval = int(card.interval * card.ease_factor)
        card.repetitions += 1
        card.next_review = datetime.utcnow() + timedelta(days=card.interval)
    elif quality == 3:  # Easy
        if card.repetitions == 0:
            card.interval = 4
        else:
            card.interval = int(card.interval * card.ease_factor * 1.3)
        card.ease_factor += 0.15
        card.repetitions += 1
        card.next_review = datetime.utcnow() + timedelta(days=card.interval)

    db.commit()
    db.refresh(card)
    return _flashcard_to_dict(card)


@router.delete("/{card_id}")
def delete_flashcard(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a flashcard."""
    card = db.query(Flashcard).filter(Flashcard.id == card_id, Flashcard.user_id == current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    db.delete(card)
    db.commit()
    return {"message": "Flashcard deleted"}


def _flashcard_to_dict(fc: Flashcard) -> dict:
    topic = None
    if fc.topic:
        topic = {"id": fc.topic.id, "title": fc.topic.title}
    return {
        "id": fc.id,
        "front": fc.front,
        "back": fc.back,
        "difficulty": fc.difficulty,
        "ease_factor": fc.ease_factor,
        "interval": fc.interval,
        "repetitions": fc.repetitions,
        "next_review": fc.next_review.isoformat() if fc.next_review else None,
        "created_at": fc.created_at.isoformat() if fc.created_at else None,
        "topic": topic
    }
