from fastapi import APIRouter
from app.api.endpoints import auth, topics, query, upload, quiz, progress, chat, flashcards, search, notes, settings, classrooms, lectures, class_analytics

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(topics.router, prefix="/topic", tags=["topics"])
api_router.include_router(query.router, prefix="/query", tags=["query"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(quiz.router, prefix="/quiz", tags=["quiz"])
api_router.include_router(progress.router, prefix="/progress", tags=["progress"])
api_router.include_router(flashcards.router, prefix="/flashcards", tags=["flashcards"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(notes.router, prefix="/notes", tags=["notes"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(classrooms.router, prefix="/classrooms", tags=["classrooms"])
api_router.include_router(lectures.router, prefix="/lectures", tags=["lectures"])
api_router.include_router(class_analytics.router, prefix="/class-analytics", tags=["class-analytics"])
