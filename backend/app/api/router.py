from fastapi import APIRouter
from app.api.endpoints import auth, topics, query, upload, quiz, progress, chat

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(topics.router, prefix="/topic", tags=["topics"])
api_router.include_router(query.router, prefix="/query", tags=["query"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
