from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import (
    User, Classroom, Lecture, LectureChat, HandRaise,
    Note, Document, Chunk, Topic, Subtopic, KnowledgeGap, QuizAttempt
)
from app.schemas import (
    LectureCreate, LectureResponse, TranscriptAppend,
    LectureChatCreate, LectureChatResponse, LectureAskRequest, LectureQuizSubmit
)
from app.services.ai import get_gemini_response
import logging
import json
import uuid

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════
# LECTURE LIFECYCLE
# ═══════════════════════════════════════

@router.post("/", response_model=LectureResponse)
def start_lecture(req: LectureCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Start a live lecture in a classroom."""
    classroom = db.query(Classroom).filter(Classroom.id == req.classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the teacher can start a lecture")

    # Generate unique Jitsi room name
    jitsi_room = f"neurobase-{classroom.id}-{uuid.uuid4().hex[:8]}"

    lecture = Lecture(
        classroom_id=classroom.id,
        user_id=current_user.id,
        title=req.title,
        is_live=True,
        jitsi_room=jitsi_room
    )
    db.add(lecture)
    db.commit()
    db.refresh(lecture)
    return lecture


@router.put("/{lecture_id}/transcript")
def append_transcript(lecture_id: int, req: TranscriptAppend, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Append text chunk to live transcript."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host teacher can append to transcript")
    if not lecture.is_live:
        raise HTTPException(status_code=400, detail="Lecture has already ended")

    lecture.transcript = (lecture.transcript + " " + req.text_chunk).strip()
    db.commit()
    return {"status": "success", "length": len(lecture.transcript)}


@router.get("/{lecture_id}/live")
def get_live_transcript(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Students + Teacher: Fetch current live transcript, topics, and status."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    return {
        "transcript": lecture.transcript,
        "is_live": lecture.is_live,
        "summary": lecture.summary,
        "detected_topics": lecture.detected_topics,
        "jitsi_room": lecture.jitsi_room
    }


@router.post("/{lecture_id}/end")
def end_lecture(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: End lecture & trigger full AI pipeline (notes + quiz + topics + Second Brain)."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lecture.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can end the lecture")

    lecture.is_live = False
    lecture.ended_at = datetime.utcnow()

    word_count = len(lecture.transcript.split()) if lecture.transcript else 0

    if word_count > 15:
        # ── 1. Generate structured notes ──
        notes_prompt = f"""You are an expert educational note-maker. Convert this raw lecture transcript into beautifully structured, comprehensive markdown notes.

Include:
- Clear section headers (##)
- Key definitions highlighted in **bold**
- Important concepts as bullet points
- Examples in their own subsections
- A "Key Takeaways" summary section at the end

Transcript:
{lecture.transcript}"""

        try:
            summary = get_gemini_response(notes_prompt)
            lecture.summary = summary

            # Save as a Note for the teacher
            note = Note(user_id=current_user.id, title=f"📝 Lecture Notes: {lecture.title}", content=summary)
            db.add(note)
        except Exception as e:
            logger.error(f"Notes generation failed: {e}")
            lecture.summary = "AI notes generation failed. Raw transcript is still available."

        # ── 2. Auto-detect topics ──
        topics_prompt = f"""From the following lecture transcript, extract the main topic and up to 5 subtopics being taught.
Return ONLY a JSON array of strings, e.g. ["Machine Learning", "Neural Networks", "Backpropagation"].
No markdown, no explanation.

Transcript:
{lecture.transcript[:3000]}"""

        try:
            topics_raw = get_gemini_response(topics_prompt)
            # Clean potential markdown wrapping
            topics_raw = topics_raw.strip().strip("```json").strip("```").strip()
            detected = json.loads(topics_raw)
            lecture.detected_topics = json.dumps(detected)

            # Auto-create Topics in user's knowledge base
            for topic_name in detected[:5]:
                existing = db.query(Topic).filter(Topic.user_id == current_user.id, Topic.title == topic_name).first()
                if not existing:
                    new_topic = Topic(user_id=current_user.id, title=topic_name, status="Neutral")
                    db.add(new_topic)
        except Exception as e:
            logger.error(f"Topic detection failed: {e}")
            lecture.detected_topics = "[]"

        # ── 3. Auto-generate quiz ──
        quiz_prompt = f"""From the following lecture transcript, generate exactly 5 multiple choice questions to test student understanding.

Return ONLY a JSON array in this exact format:
[
  {{
    "question": "What is X?",
    "options": ["A) Option1", "B) Option2", "C) Option3", "D) Option4"],
    "correct": 0,
    "explanation": "Brief explanation"
  }}
]

No markdown wrapping, no extra text.

Transcript:
{lecture.transcript[:3000]}"""

        try:
            quiz_raw = get_gemini_response(quiz_prompt)
            quiz_raw = quiz_raw.strip().strip("```json").strip("```").strip()
            quiz_data = json.loads(quiz_raw)
            lecture.auto_quiz = json.dumps(quiz_data)
        except Exception as e:
            logger.error(f"Quiz generation failed: {e}")
            lecture.auto_quiz = "[]"

        # ── 4. Save to Second Brain (Document + Chunks for RAG) ──
        try:
            doc = Document(user_id=current_user.id, title=f"Lecture Transcript: {lecture.title}", source_type="lecture")
            db.add(doc)
            db.commit()
            db.refresh(doc)

            # Chunk transcript into ~500 word pieces for better RAG retrieval
            words = lecture.transcript.split()
            chunk_size = 500
            for i in range(0, len(words), chunk_size):
                chunk_text = " ".join(words[i:i + chunk_size])
                chunk = Chunk(document_id=doc.id, user_id=current_user.id, text=chunk_text, chunk_index=i // chunk_size)
                db.add(chunk)
        except Exception as e:
            logger.error(f"Second Brain storage failed: {e}")

    db.commit()
    db.refresh(lecture)
    return lecture


# ═══════════════════════════════════════
# LIVE CHAT
# ═══════════════════════════════════════

@router.post("/{lecture_id}/chat", response_model=LectureChatResponse)
def send_chat_message(lecture_id: int, req: LectureChatCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send a chat message during live lecture."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    msg = LectureChat(
        lecture_id=lecture.id,
        user_id=current_user.id,
        message=req.message,
        is_ai_response=False
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("/{lecture_id}/chat")
def get_chat_messages(lecture_id: int, after_id: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get chat messages (supports polling via after_id)."""
    messages = db.query(LectureChat).filter(
        LectureChat.lecture_id == lecture_id,
        LectureChat.id > after_id
    ).order_by(LectureChat.created_at.asc()).limit(100).all()

    result = []
    for m in messages:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "user_email": user.email if user else "Unknown",
            "message": m.message,
            "is_ai_response": m.is_ai_response,
            "created_at": m.created_at.isoformat()
        })
    return result


# ═══════════════════════════════════════
# RAISE HAND
# ═══════════════════════════════════════

@router.post("/{lecture_id}/raise-hand")
def toggle_hand(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Student: Toggle raise/lower hand."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    existing = db.query(HandRaise).filter(
        HandRaise.lecture_id == lecture_id,
        HandRaise.user_id == current_user.id,
        HandRaise.is_active == True
    ).first()

    if existing:
        existing.is_active = False
        db.commit()
        return {"status": "lowered"}
    else:
        hand = HandRaise(lecture_id=lecture_id, user_id=current_user.id, is_active=True)
        db.add(hand)
        db.commit()
        return {"status": "raised"}


@router.get("/{lecture_id}/hands")
def get_raised_hands(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all currently raised hands."""
    hands = db.query(HandRaise).filter(
        HandRaise.lecture_id == lecture_id,
        HandRaise.is_active == True
    ).all()

    result = []
    for h in hands:
        user = db.query(User).filter(User.id == h.user_id).first()
        result.append({"user_id": h.user_id, "email": user.email if user else "Unknown"})
    return result


# ═══════════════════════════════════════
# AI TOPIC DETECTION (mid-lecture)
# ═══════════════════════════════════════

@router.post("/{lecture_id}/detect-topic")
def detect_current_topic(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """AI detects the current topic from recent transcript. Called periodically by teacher frontend."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    words = lecture.transcript.split()
    if len(words) < 20:
        return {"topic": "Waiting for more content..."}

    # Use last ~200 words for topic detection
    recent_text = " ".join(words[-200:])

    prompt = f"""From the following recent lecture excerpt, identify the single main topic currently being discussed.
Return ONLY the topic name, nothing else. Example: "Database Normalization"

Excerpt: {recent_text}"""

    try:
        topic = get_gemini_response(prompt).strip().strip('"').strip("'")
        # Update detected topics on the lecture
        try:
            current_topics = json.loads(lecture.detected_topics) if lecture.detected_topics else []
        except:
            current_topics = []

        if topic and topic not in current_topics:
            current_topics.append(topic)
            lecture.detected_topics = json.dumps(current_topics)
            db.commit()

        return {"topic": topic}
    except Exception as e:
        return {"topic": "Detection unavailable"}


# ═══════════════════════════════════════
# DOUBT RESOLUTION (AI-powered during/after class)
# ═══════════════════════════════════════

@router.post("/{lecture_id}/ask-ai")
def ask_ai_about_lecture(lecture_id: int, req: LectureAskRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Ask AI a question about this specific lecture's content (RAG-scoped)."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Build context from transcript + notes
    context = f"LECTURE TRANSCRIPT:\n{lecture.transcript}\n\n"
    if lecture.summary:
        context += f"AI-GENERATED NOTES:\n{lecture.summary}\n\n"

    prompt = f"""You are an AI tutor helping a student understand a lecture. Use ONLY the provided lecture content to answer.
If the answer is not in the content, say "This wasn't covered in this lecture."

{context}

STUDENT QUESTION: {req.question}

Provide a clear, helpful answer:"""

    try:
        answer = get_gemini_response(prompt)

        # Save as an AI chat message in the lecture chat
        ai_msg = LectureChat(
            lecture_id=lecture_id,
            user_id=current_user.id,
            message=f"**Q:** {req.question}\n\n**A:** {answer}",
            is_ai_response=True
        )
        db.add(ai_msg)
        db.commit()

        return {"answer": answer}
    except Exception as e:
        return {"answer": f"AI is temporarily unavailable: {str(e)}"}


# ═══════════════════════════════════════
# POST-CLASS REVIEW
# ═══════════════════════════════════════

@router.get("/{lecture_id}/review")
def get_lecture_review(lecture_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get full post-class review data: transcript, notes, quiz, topics, chat history."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Get chat history
    chats = db.query(LectureChat).filter(LectureChat.lecture_id == lecture_id).order_by(LectureChat.created_at.asc()).all()
    chat_list = []
    for c in chats:
        user = db.query(User).filter(User.id == c.user_id).first()
        chat_list.append({
            "id": c.id, "user_email": user.email if user else "Unknown",
            "message": c.message, "is_ai_response": c.is_ai_response,
            "created_at": c.created_at.isoformat()
        })

    # Parse quiz and topics safely
    try:
        quiz = json.loads(lecture.auto_quiz) if lecture.auto_quiz else []
    except:
        quiz = []
    try:
        topics = json.loads(lecture.detected_topics) if lecture.detected_topics else []
    except:
        topics = []

    # Get classroom name
    classroom = db.query(Classroom).filter(Classroom.id == lecture.classroom_id).first()

    return {
        "id": lecture.id,
        "title": lecture.title,
        "classroom_name": classroom.name if classroom else "",
        "classroom_id": lecture.classroom_id,
        "transcript": lecture.transcript,
        "summary": lecture.summary,
        "detected_topics": topics,
        "auto_quiz": quiz,
        "is_live": lecture.is_live,
        "started_at": lecture.started_at.isoformat() if lecture.started_at else None,
        "ended_at": lecture.ended_at.isoformat() if lecture.ended_at else None,
        "chat_history": chat_list
    }


# ═══════════════════════════════════════
# LECTURE QUIZ SUBMISSION + WEAKNESS DETECTION
# ═══════════════════════════════════════

@router.post("/{lecture_id}/submit-quiz")
def submit_lecture_quiz(lecture_id: int, req: LectureQuizSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Submit quiz results for a lecture and detect weaknesses."""
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Save attempt
    attempt = QuizAttempt(
        user_id=current_user.id,
        lecture_id=lecture_id,
        score=req.score,
        total_questions=req.total_questions
    )
    db.add(attempt)

    # Weakness detection: if score < 60%, add knowledge gaps
    if req.total_questions > 0:
        pct = (req.score / req.total_questions) * 100
        if pct < 60:
            try:
                topics = json.loads(lecture.detected_topics) if lecture.detected_topics else []
                for topic_name in topics[:3]:
                    gap = KnowledgeGap(
                        user_id=current_user.id,
                        description=f"Weak performance on lecture '{lecture.title}' — topic: {topic_name}",
                        suggested_topic=topic_name,
                        source="lecture"
                    )
                    db.add(gap)
            except:
                pass

    db.commit()
    return {"message": "Quiz submitted. Weakness analysis complete."}
