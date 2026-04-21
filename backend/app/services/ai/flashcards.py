"""
Flashcard Generator — Generates Q/A flashcards from topic content via Gemini.
"""
import json
from app.services.ai import get_gemini_response
from app.db.models import Topic, Subtopic
from sqlalchemy.orm import Session


def generate_flashcards_for_topic(topic_id: int, user_id: int, db: Session) -> list[dict]:
    """Generate flashcards from a topic's subtopic content."""
    topic = db.query(Topic).filter(Topic.id == topic_id, Topic.user_id == user_id).first()
    if not topic:
        return []

    subtopics = db.query(Subtopic).filter(Subtopic.topic_id == topic_id).all()
    content_parts = [f"## {s.title}\n{s.content}" for s in subtopics if s.content]
    context = "\n\n".join(content_parts)

    if not context:
        context = f'Topic: "{topic.title}". Generate flashcards using general knowledge about this subject.'

    prompt = f"""You are an AI flashcard creator. Generate 8-12 high-quality flashcards for studying the topic: "{topic.title}".

{f'Base your flashcards on this study material:{chr(10)}{context[:5000]}' if content_parts else context}

Requirements:
- Each flashcard has a "front" (question/prompt) and "back" (answer/explanation)
- Mix types: definitions, concepts, examples, application questions
- Vary difficulty: some easy (definitions), some medium (explanations), some hard (applications)
- Keep fronts concise (1-2 sentences max)
- Keep backs informative but not too long (2-4 sentences)

Return ONLY a raw JSON array (no markdown backticks, no extra text):
[
  {{"front": "What is X?", "back": "X is...", "difficulty": "easy"}},
  {{"front": "Explain how Y works", "back": "Y works by...", "difficulty": "medium"}},
  {{"front": "Apply Z to this scenario...", "back": "In this case...", "difficulty": "hard"}}
]"""

    text = get_gemini_response(prompt)
    try:
        text = text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        cards = json.loads(text.strip())
        # Validate structure
        validated = []
        for card in cards:
            if isinstance(card, dict) and "front" in card and "back" in card:
                validated.append({
                    "front": str(card["front"]),
                    "back": str(card["back"]),
                    "difficulty": card.get("difficulty", "medium")
                })
        return validated
    except Exception:
        return [
            {"front": f"What is {topic.title}?", "back": f"{topic.title} is a key topic in this subject area.", "difficulty": "easy"},
            {"front": f"Why is {topic.title} important?", "back": f"{topic.title} is essential for understanding the broader field.", "difficulty": "medium"},
        ]
