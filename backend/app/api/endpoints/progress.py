from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Topic, Subtopic, KnowledgeGap, Document, QuizAttempt
from app.services.ai.generator import generate_insights

router = APIRouter()


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard data: stats, AI insights, recent topics."""
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    docs_count = db.query(Document).filter(Document.user_id == current_user.id).count()
    quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    gaps = db.query(KnowledgeGap).filter(KnowledgeGap.user_id == current_user.id).all()

    # Compute stats
    strong = sum(1 for t in topics if t.status == "Strong")
    medium = sum(1 for t in topics if t.status == "Medium")
    weak = sum(1 for t in topics if t.status == "Weak")
    neutral = sum(1 for t in topics if t.status == "Neutral")

    avg_score = 0
    if quiz_attempts:
        total_score = sum(a.score for a in quiz_attempts)
        total_q = sum(a.total_questions for a in quiz_attempts)
        avg_score = round((total_score / total_q * 100) if total_q > 0 else 0)

    # Generate personalized insights
    topics_data = [{"title": t.title, "status": t.status} for t in topics]
    gaps_data = [{"description": g.description} for g in gaps]
    quiz_data = [{"score": a.score, "total": a.total_questions} for a in quiz_attempts]
    insights = generate_insights(topics_data, gaps_data, quiz_data)

    # Recent topics
    recent_topics = [
        {"id": t.id, "title": t.title, "status": t.status}
        for t in sorted(topics, key=lambda x: x.created_at, reverse=True)[:5]
    ]

    return {
        "stats": {
            "total_topics": len(topics),
            "total_documents": docs_count,
            "total_quizzes": len(quiz_attempts),
            "avg_score": avg_score,
            "strong": strong,
            "medium": medium,
            "weak": weak,
            "neutral": neutral,
            "total_gaps": len(gaps)
        },
        "insights": insights,
        "recent_topics": recent_topics
    }


@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed analytics: topic strengths, quiz history, gaps."""
    topics = db.query(Topic).filter(Topic.user_id == current_user.id).all()
    quiz_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.created_at.asc())
        .all()
    )
    gaps = db.query(KnowledgeGap).filter(KnowledgeGap.user_id == current_user.id).all()

    # Topic strength breakdown
    topic_strengths = [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "subtopic_count": db.query(Subtopic).filter(Subtopic.topic_id == t.id).count(),
            "notes_count": db.query(Subtopic).filter(
                Subtopic.topic_id == t.id,
                Subtopic.content.isnot(None)
            ).count()
        }
        for t in topics
    ]

    # Quiz history
    quiz_history = []
    for a in quiz_attempts:
        topic = db.query(Topic).filter(Topic.id == a.topic_id).first()
        quiz_history.append({
            "topic_title": topic.title if topic else "Deleted Topic",
            "score": a.score,
            "total": a.total_questions,
            "percentage": round(a.score / a.total_questions * 100) if a.total_questions > 0 else 0,
            "created_at": a.created_at.isoformat()
        })

    return {
        "topic_strengths": topic_strengths,
        "quiz_history": quiz_history,
        "gaps": [
            {"id": g.id, "description": g.description, "suggested_topic": g.suggested_topic}
            for g in gaps
        ]
    }


@router.get("/gaps")
def get_user_gaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all knowledge gaps for the current user."""
    gaps = db.query(KnowledgeGap).filter(KnowledgeGap.user_id == current_user.id).all()
    return {
        "gaps": [
            {"id": g.id, "description": g.description, "suggested_topic": g.suggested_topic}
            for g in gaps
        ]
    }
