from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import (
    User, Classroom, ClassEnrollment, Lecture, LectureChat,
    QuizAttempt, KnowledgeGap, HandRaise
)
import json

router = APIRouter()


@router.get("/classroom/{classroom_id}")
def get_classroom_analytics(classroom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher: Get analytics for a specific classroom."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Total students
    student_count = db.query(ClassEnrollment).filter(ClassEnrollment.classroom_id == classroom_id).count()

    # Total lectures
    lectures = db.query(Lecture).filter(Lecture.classroom_id == classroom_id).all()
    total_lectures = len(lectures)
    live_now = sum(1 for l in lectures if l.is_live)

    # Per-lecture stats
    lecture_stats = []
    all_topics = []
    total_chat_msgs = 0
    total_hand_raises = 0

    for lecture in lectures:
        chat_count = db.query(LectureChat).filter(LectureChat.lecture_id == lecture.id, LectureChat.is_ai_response == False).count()
        hand_count = db.query(HandRaise).filter(HandRaise.lecture_id == lecture.id).count()
        quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.lecture_id == lecture.id).all()

        avg_score = 0
        if quiz_attempts:
            scores = [(a.score / a.total_questions * 100) if a.total_questions > 0 else 0 for a in quiz_attempts]
            avg_score = round(sum(scores) / len(scores), 1)

        try:
            topics = json.loads(lecture.detected_topics) if lecture.detected_topics else []
        except:
            topics = []
        all_topics.extend(topics)

        lecture_stats.append({
            "id": lecture.id,
            "title": lecture.title,
            "date": lecture.started_at.isoformat() if lecture.started_at else None,
            "chat_messages": chat_count,
            "hand_raises": hand_count,
            "quiz_attempts": len(quiz_attempts),
            "avg_quiz_score": avg_score,
            "topics": topics
        })

        total_chat_msgs += chat_count
        total_hand_raises += hand_count

    # Most discussed topics (frequency)
    topic_freq = {}
    for t in all_topics:
        topic_freq[t] = topic_freq.get(t, 0) + 1
    hot_topics = sorted(topic_freq.items(), key=lambda x: -x[1])[:10]

    # Most active students (by chat messages across all lectures)
    student_activity = {}
    for lecture in lectures:
        chats = db.query(LectureChat).filter(
            LectureChat.lecture_id == lecture.id,
            LectureChat.is_ai_response == False
        ).all()
        for chat in chats:
            student_activity[chat.user_id] = student_activity.get(chat.user_id, 0) + 1

    active_students = []
    for uid, count in sorted(student_activity.items(), key=lambda x: -x[1])[:10]:
        user = db.query(User).filter(User.id == uid).first()
        active_students.append({"email": user.email if user else "Unknown", "messages": count})

    return {
        "classroom_name": classroom.name,
        "student_count": student_count,
        "total_lectures": total_lectures,
        "live_now": live_now,
        "total_chat_messages": total_chat_msgs,
        "total_hand_raises": total_hand_raises,
        "hot_topics": [{"topic": t, "count": c} for t, c in hot_topics],
        "active_students": active_students,
        "lecture_stats": lecture_stats
    }


@router.get("/student")
def get_student_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Student: Get personal learning analytics across all enrolled classes."""
    # Get enrolled classrooms
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).all()
    classroom_ids = [e.classroom_id for e in enrollments]

    # Lectures in those classrooms
    lectures = db.query(Lecture).filter(
        Lecture.classroom_id.in_(classroom_ids),
        Lecture.is_live == False
    ).all() if classroom_ids else []

    total_lectures = len(lectures)

    # Quiz performance
    quiz_attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    lecture_quiz_attempts = [a for a in quiz_attempts if a.lecture_id is not None]

    avg_score = 0
    if lecture_quiz_attempts:
        scores = [(a.score / a.total_questions * 100) if a.total_questions > 0 else 0 for a in lecture_quiz_attempts]
        avg_score = round(sum(scores) / len(scores), 1)

    # Knowledge gaps
    gaps = db.query(KnowledgeGap).filter(
        KnowledgeGap.user_id == current_user.id,
        KnowledgeGap.source == "lecture"
    ).all()

    weak_topics = list(set([g.suggested_topic for g in gaps if g.suggested_topic]))

    # Lectures taken vs missed (simple: answered quiz = attended)
    attended_lecture_ids = set([a.lecture_id for a in lecture_quiz_attempts if a.lecture_id])
    lectures_attended = len(attended_lecture_ids)
    lectures_missed = total_lectures - lectures_attended

    # Chat engagement
    total_questions = 0
    for lecture in lectures:
        q_count = db.query(LectureChat).filter(
            LectureChat.lecture_id == lecture.id,
            LectureChat.user_id == current_user.id,
            LectureChat.is_ai_response == False
        ).count()
        total_questions += q_count

    # Notifications / reminders
    reminders = []
    for lecture in lectures[-5:]:  # Last 5 lectures
        lid = lecture.id
        if lid not in attended_lecture_ids:
            reminders.append(f"📝 You missed '{lecture.title}' — review the notes!")
        else:
            attempt = next((a for a in lecture_quiz_attempts if a.lecture_id == lid), None)
            if attempt and attempt.total_questions > 0:
                pct = (attempt.score / attempt.total_questions) * 100
                if pct < 70:
                    reminders.append(f"🔄 Revise '{lecture.title}' — you scored {pct:.0f}%")

    if not reminders:
        reminders.append("✅ You're all caught up! Great work.")

    return {
        "total_lectures_available": total_lectures,
        "lectures_attended": lectures_attended,
        "lectures_missed": lectures_missed,
        "avg_quiz_score": avg_score,
        "total_quiz_attempts": len(lecture_quiz_attempts),
        "total_questions_asked": total_questions,
        "weak_topics": weak_topics,
        "reminders": reminders
    }
