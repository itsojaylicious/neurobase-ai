from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TopicCreate(BaseModel):
    title: str

class SubtopicResponse(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    is_generated: bool
    class Config:
        from_attributes = True

class TopicResponse(BaseModel):
    id: int
    title: str
    status: str
    created_at: datetime
    subtopics: List[SubtopicResponse] = []
    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: int
    title: str
    source_type: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    question: str

class QuizGenerateRequest(BaseModel):
    topic_id: int

class QuizSubmitRequest(BaseModel):
    topic_id: int
    score: int
    total_questions: int
