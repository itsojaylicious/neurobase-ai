from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, ChatMessage
from app.services.ai.rag import query_rag

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


@router.post("/")
def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send a message to the AI tutor. Stores chat history and uses RAG."""
    # Save user message
    user_msg = ChatMessage(user_id=current_user.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Get AI response using RAG
    try:
        answer = query_rag(request.message, current_user.id, db)
    except Exception as e:
        answer = f"I'm having trouble processing your request right now. Please try again."

    # Save AI response
    ai_msg = ChatMessage(user_id=current_user.id, role="assistant", content=answer)
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return {
        "user_message": {
            "id": user_msg.id,
            "role": "user",
            "content": request.message,
            "created_at": user_msg.created_at.isoformat()
        },
        "ai_message": {
            "id": ai_msg.id,
            "role": "assistant",
            "content": answer,
            "created_at": ai_msg.created_at.isoformat()
        }
    }


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the user's chat history."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(200)
        .all()
    )
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }


@router.delete("/history")
def clear_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clear all chat history for the current user."""
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Chat history cleared"}
