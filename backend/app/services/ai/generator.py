"""
AI Content Generator — Topic/subtopic generation and learning insights via Gemini.
"""
import json
from app.services.ai import get_gemini_response


def generate_subtopics(topic_title: str) -> list[str]:
    """Generate structured subtopics for a given topic."""
    prompt = f"""You are an AI curriculum designer. Generate an ordered list of 6-10 core subtopics to master the subject: "{topic_title}".
Order from foundational concepts to advanced applications.
Return ONLY a raw JSON array of strings. No markdown, no explanation, no triple backticks.
Example: ["Introduction to X", "Core Concepts of X", "Advanced X Applications"]"""

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
        return [
            f"Introduction to {topic_title}",
            "Fundamental Concepts",
            "Key Principles",
            "Practical Applications",
            "Advanced Topics"
        ]


def generate_notes(subtopic_title: str, topic_title: str = "") -> str:
    """Generate comprehensive study notes for a subtopic."""
    context = f" in the context of {topic_title}" if topic_title else ""
    prompt = f"""You are an expert AI tutor. Create comprehensive study notes for: "{subtopic_title}"{context}.

Requirements:
- Start with a brief overview
- Explain key concepts clearly with depth
- Include real-world examples
- Add important formulas, rules, or definitions if applicable
- Use bullet points for key takeaways
- Use clear markdown formatting with headers (##, ###), bold text, code blocks where relevant

Make the notes thorough enough that a student could learn the topic entirely from these notes."""
    return get_gemini_response(prompt)


def generate_insights(topics_data: list, gaps_data: list, quiz_data: list) -> list[str]:
    """Generate personalized daily insights from user's learning data."""
    insights = []

    weak_topics = [t["title"] for t in topics_data if t["status"] == "Weak"]
    medium_topics = [t["title"] for t in topics_data if t["status"] == "Medium"]
    strong_topics = [t["title"] for t in topics_data if t["status"] == "Strong"]
    neutral_topics = [t["title"] for t in topics_data if t["status"] == "Neutral"]

    if weak_topics:
        insights.append(f"🔴 Focus needed: You're weak in {', '.join(weak_topics[:3])}. Consider revising these topics and retaking quizzes.")
    if medium_topics:
        insights.append(f"🟡 Almost there: {', '.join(medium_topics[:3])} need a bit more practice to become strong.")
    if strong_topics:
        insights.append(f"🟢 Great progress! You're strong in {', '.join(strong_topics[:3])}. Keep it up!")
    if neutral_topics:
        insights.append(f"📚 Untested: Take a quiz on {', '.join(neutral_topics[:3])} to assess your knowledge level.")
    if gaps_data:
        insights.append(f"⚠️ {len(gaps_data)} knowledge gap(s) detected. Check the Knowledge Gaps page for recommendations.")
    if not topics_data:
        insights.append("🚀 Get started by generating your first topic or uploading study material!")
    if quiz_data and len(quiz_data) >= 3:
        recent_scores = [q["score"] / q["total"] * 100 if q["total"] > 0 else 0 for q in quiz_data[-3:]]
        avg_recent = sum(recent_scores) / len(recent_scores)
        if avg_recent >= 80:
            insights.append("📈 Your recent quiz performance is excellent! Consider exploring more advanced topics.")
        elif avg_recent < 50:
            insights.append("📉 Recent quiz scores are low. Try reviewing your notes before attempting quizzes.")

    return insights
