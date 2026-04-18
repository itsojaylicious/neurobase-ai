"""
Quiz Generator — Generates MCQ quizzes and analyzes knowledge gaps via Gemini.
"""
from app.db.models import Topic, Subtopic, KnowledgeGap
from sqlalchemy.orm import Session
import json
from app.services.ai import get_gemini_response


def generate_quiz(topic_id: int, user_id: int, db: Session) -> dict:
    """Generate a quiz for a topic, difficulty adapts to topic status."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        return {"questions": []}

    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic_id).all()
    context = "\n\n".join([f"## {s.title}\n{s.content}" for s in subtopics if s.content])

    # Adaptive difficulty
    difficulty = "medium"
    if topic.status == "Strong":
        difficulty = "hard"
    elif topic.status == "Weak":
        difficulty = "easy"

    base_context = f'Base your questions on this study material:\n{context[:4000]}' if context else f'Create questions about "{topic.title}" using general knowledge.'

    prompt = f"""You are an AI teacher. Generate a quiz with 5 multiple-choice questions about "{topic.title}".
Difficulty level: {difficulty}

{base_context}

Return ONLY a raw JSON object (no markdown backticks, no extra text) matching this exact schema:
{{
  "questions": [
    {{
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0,
      "explanation": "Brief explanation of why this answer is correct"
    }}
  ]
}}"""

    text = get_gemini_response(prompt)
    try:
        text = text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        return json.loads(text.strip())
    except Exception:
        return {"questions": []}


def analyze_gaps(topic_id: int, score: int, total_questions: int, user_id: int, db: Session):
    """Analyze quiz performance, update topic status, detect knowledge gaps."""
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        return

    percentage = (score / total_questions * 100) if total_questions > 0 else 0

    if percentage >= 80:
        topic.status = "Strong"
    elif percentage >= 50:
        topic.status = "Medium"
    else:
        topic.status = "Weak"
        # Add knowledge gap if not already tracked
        existing = db.query(KnowledgeGap).filter(
            KnowledgeGap.user_id == user_id,
            KnowledgeGap.suggested_topic == topic.title
        ).first()
        if not existing:
            gap = KnowledgeGap(
                user_id=user_id,
                description=f"Low score ({score}/{total_questions}) on {topic.title}. Consider revising this topic and its subtopics.",
                suggested_topic=topic.title
            )
            db.add(gap)

    db.commit()
