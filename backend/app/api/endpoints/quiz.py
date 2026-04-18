from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, QuizAttempt
from app.services.ai.quiz import generate_quiz, analyze_gaps

router = APIRouter()


class QuizGenerateRequest(BaseModel):
    topic_id: int


class QuizSubmitRequest(BaseModel):
    topic_id: int
    score: int
    total_questions: int


@router.post("/generate")
def api_generate_quiz(
    request: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate a quiz for a given topic. Difficulty adapts to topic status."""
    try:
        quiz = generate_quiz(request.topic_id, current_user.id, db)
        return {"topic_id": request.topic_id, "quiz": quiz}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit")
def api_submit_quiz(
    request: QuizSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit quiz results. Updates topic status and detects knowledge gaps."""
    try:
        # Save Attempt
        attempt = QuizAttempt(
            user_id=current_user.id,
            topic_id=request.topic_id,
            score=request.score,
            total_questions=request.total_questions
        )
        db.add(attempt)
        db.commit()

        # Analyze performance and update topic status
        analyze_gaps(request.topic_id, request.score, request.total_questions, current_user.id, db)

        return {"message": "Quiz submitted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
