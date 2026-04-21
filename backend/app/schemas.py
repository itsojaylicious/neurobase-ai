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


# ═══════════════════════════════════════════════════════════
# LIVE CLASS SYSTEM SCHEMAS
# ═══════════════════════════════════════════════════════════

class ClassroomCreate(BaseModel):
    name: str
    subject: Optional[str] = ""
    description: Optional[str] = ""
    schedule: Optional[str] = ""

class ClassroomJoin(BaseModel):
    join_code: str

class ClassroomResponse(BaseModel):
    id: int
    teacher_id: int
    name: str
    subject: str
    description: str
    schedule: str
    join_code: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class MaterialCreate(BaseModel):
    title: str
    content: Optional[str] = ""
    material_type: Optional[str] = "note"  # note, link

class MaterialResponse(BaseModel):
    id: int
    title: str
    content: str
    material_type: str
    created_at: datetime
    class Config:
        from_attributes = True

class LectureCreate(BaseModel):
    classroom_id: int
    title: str

class LectureResponse(BaseModel):
    id: int
    classroom_id: int
    title: str
    transcript: str
    summary: str
    detected_topics: str
    auto_quiz: str
    is_live: bool
    jitsi_room: str
    started_at: datetime
    ended_at: Optional[datetime]
    class Config:
        from_attributes = True

class TranscriptAppend(BaseModel):
    text_chunk: str

class LectureChatCreate(BaseModel):
    message: str

class LectureChatResponse(BaseModel):
    id: int
    user_id: int
    message: str
    is_ai_response: bool
    created_at: datetime
    class Config:
        from_attributes = True

class LectureAskRequest(BaseModel):
    question: str

class LectureQuizSubmit(BaseModel):
    score: int
    total_questions: int

class SharedResourceResponse(BaseModel):
    id: int
    resource_type: str
    resource_id: int
    permission: str
    class Config:
        from_attributes = True
