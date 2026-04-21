from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, DateTime, Float, JSON
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime, timedelta

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student")  # student, teacher, admin
    created_at = Column(DateTime, default=datetime.utcnow)

    topics = relationship("Topic", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    knowledge_gaps = relationship("KnowledgeGap", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="user", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    lectures = relationship("Lecture", back_populates="user", cascade="all, delete-orphan")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    source_type = Column(String)  # "pdf", "txt", "lecture"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan")

class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    text = Column(Text, nullable=False)
    chunk_index = Column(Integer)

    document = relationship("Document", back_populates="chunks")

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    status = Column(String, default="Neutral")  # Strong, Medium, Weak, Neutral
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="topics")
    subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="topic", cascade="all, delete-orphan")

class Subtopic(Base):
    __tablename__ = "subtopics"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    is_generated = Column(Boolean, default=False)

    topic = relationship("Topic", back_populates="subtopics")

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=True)
    score = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_attempts")
    topic = relationship("Topic", back_populates="quiz_attempts")

class KnowledgeGap(Base):
    __tablename__ = "knowledge_gaps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    description = Column(Text, nullable=False)
    suggested_topic = Column(String)
    source = Column(String, default="quiz")  # quiz, lecture, chat

    user = relationship("User", back_populates="knowledge_gaps")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chat_messages")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    difficulty = Column(String, default="medium")  # easy, medium, hard
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)  # days until next review
    repetitions = Column(Integer, default=0)
    next_review = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="flashcards")
    topic = relationship("Topic")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    is_pinned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="notes")
    topic = relationship("Topic")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    display_name = Column(String, default="")
    learning_style = Column(String, default="balanced")  # visual, reading, practice, balanced
    theme = Column(String, default="dark")  # dark, light
    gemini_api_key = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="profile")


# ═══════════════════════════════════════════════════════════
# LIVE CLASS SYSTEM MODELS
# ═══════════════════════════════════════════════════════════

class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    subject = Column(String, default="")
    description = Column(Text, default="")
    schedule = Column(String, default="")  # e.g. "Mon/Wed/Fri 10:00 AM"
    join_code = Column(String, unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User")
    enrollments = relationship("ClassEnrollment", back_populates="classroom", cascade="all, delete-orphan")
    resources = relationship("ClassResource", back_populates="classroom", cascade="all, delete-orphan")
    materials = relationship("ClassMaterial", back_populates="classroom", cascade="all, delete-orphan")
    lectures = relationship("Lecture", back_populates="classroom", cascade="all, delete-orphan")


class ClassEnrollment(Base):
    __tablename__ = "class_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    student_id = Column(Integer, ForeignKey("users.id"))
    enrolled_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("User")


class ClassResource(Base):
    __tablename__ = "class_resources"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    title = Column(String, nullable=False)
    content = Column(Text, default="")
    resource_type = Column(String, default="note")  # note, transcript
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="resources")


class ClassMaterial(Base):
    """Pre-class materials uploaded by teacher (links, notes, descriptions)."""
    __tablename__ = "class_materials"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    title = Column(String, nullable=False)
    content = Column(Text, default="")  # text content or URL
    material_type = Column(String, default="note")  # note, link, file
    created_at = Column(DateTime, default=datetime.utcnow)

    classroom = relationship("Classroom", back_populates="materials")


class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    transcript = Column(Text, default="")
    summary = Column(Text, default="")
    detected_topics = Column(Text, default="[]")  # JSON string of detected topic names
    auto_quiz = Column(Text, default="[]")  # JSON string of auto-generated MCQs
    is_live = Column(Boolean, default=True)
    jitsi_room = Column(String, default="")  # Jitsi room name
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    classroom = relationship("Classroom", back_populates="lectures")
    user = relationship("User", back_populates="lectures")
    chat_messages = relationship("LectureChat", back_populates="lecture", cascade="all, delete-orphan")
    hand_raises = relationship("HandRaise", back_populates="lecture", cascade="all, delete-orphan")


class LectureChat(Base):
    """Real-time chat messages during a live lecture."""
    __tablename__ = "lecture_chats"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    is_ai_response = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    lecture = relationship("Lecture", back_populates="chat_messages")
    user = relationship("User")


class HandRaise(Base):
    """Students raising hands during lecture."""
    __tablename__ = "hand_raises"

    id = Column(Integer, primary_key=True, index=True)
    lecture_id = Column(Integer, ForeignKey("lectures.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lecture = relationship("Lecture", back_populates="hand_raises")
    user = relationship("User")


class SharedResource(Base):
    __tablename__ = "shared_resources"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    shared_with_id = Column(Integer, ForeignKey("users.id"))
    resource_type = Column(String, nullable=False)
    resource_id = Column(Integer, nullable=False)
    permission = Column(String, default="view")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])
    shared_with = relationship("User", foreign_keys=[shared_with_id])


class StudyGroup(Base):
    __tablename__ = "study_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    creator_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User")
    members = relationship("StudyGroupMember", back_populates="group", cascade="all, delete-orphan")


class StudyGroupMember(Base):
    __tablename__ = "study_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("study_groups.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member")
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("StudyGroup", back_populates="members")
    user = relationship("User")
