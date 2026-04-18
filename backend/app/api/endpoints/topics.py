from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Topic, Subtopic
from app.services.ai.generator import generate_subtopics, generate_notes

router = APIRouter()


@router.get("/")
def list_topics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all topics for the current user."""
    topics = (
        db.query(Topic)
        .filter(Topic.user_id == current_user.id)
        .order_by(Topic.created_at.desc())
        .all()
    )
    return {
        "topics": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
                "subtopic_count": db.query(Subtopic).filter(Subtopic.topic_id == t.id).count()
            }
            for t in topics
        ]
    }


@router.get("/{topic_id}")
def get_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single topic with all its subtopics."""
    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.user_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic.id).all()
    return {
        "id": topic.id,
        "title": topic.title,
        "status": topic.status,
        "created_at": topic.created_at.isoformat(),
        "subtopics": [
            {
                "id": s.id,
                "title": s.title,
                "content": s.content,
                "is_generated": s.is_generated
            }
            for s in subtopics
        ]
    }


@router.post("/generate-subtopics")
def api_generate_subtopics(
    title: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate subtopics for a new topic using AI."""
    try:
        # Create Topic
        new_topic = Topic(title=title, user_id=current_user.id)
        db.add(new_topic)
        db.commit()
        db.refresh(new_topic)

        # Generate with Gemini
        subtopics_list = generate_subtopics(title)

        # Save Subtopics
        for st in subtopics_list:
            new_subtopic = Subtopic(topic_id=new_topic.id, title=st, is_generated=True)
            db.add(new_subtopic)
        db.commit()

        return {"topic_id": new_topic.id, "title": title, "subtopics": subtopics_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-notes")
def api_generate_notes(
    subtopic_id: int = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate study notes for a specific subtopic using AI."""
    subtopic = db.query(Subtopic).filter(Subtopic.id == subtopic_id).first()
    if not subtopic:
        raise HTTPException(status_code=404, detail="Subtopic not found")

    topic = db.query(Topic).filter(Topic.id == subtopic.topic_id).first()
    if topic.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        content = generate_notes(subtopic.title, topic.title)
        subtopic.content = content
        db.commit()
        return {"subtopic_id": subtopic.id, "title": subtopic.title, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{topic_id}")
def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a topic and all its subtopics."""
    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.user_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted"}
