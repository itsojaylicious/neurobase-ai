from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.db.models import User
from app.services.ai.rag import query_rag
from sqlalchemy.orm import Session
from app.db.session import get_db

router = APIRouter()


class QueryRequest(BaseModel):
    question: str


@router.post("/")
def make_query(
    request: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Quick RAG query without chat history persistence."""
    try:
        answer = query_rag(request.question, current_user.id, db)
        return {"question": request.question, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
