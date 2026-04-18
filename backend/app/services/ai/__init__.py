"""
Centralized AI client — single source of truth for all AI calls.
"""
import requests
from app.core.config import settings

def get_gemini_response(prompt: str) -> str:
    """Call Google Gemini API directly to avoid quota limits from OpenAI."""
    api_key = getattr(settings, "GEMINI_API_KEY", None)
    if not api_key:
        return "AI Configuration Error: GEMINI_API_KEY is not set in your .env file."

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "contents": [{
            "parts":[{"text": prompt}]
        }]
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=90)
        response.raise_for_status()
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except requests.exceptions.HTTPError as e:
        status = e.response.status_code
        err_msg = e.response.text
        return f"AI service error (HTTP {status}): {err_msg}"
    except requests.exceptions.Timeout:
        return "AI request timed out. Please try again."
    except Exception as e:
        return f"AI service is temporarily unavailable. Details: {str(e)}"
