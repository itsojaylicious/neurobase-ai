"""
Settings API — User profile, preferences, and API key management.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, UserProfile
from app.core.security import get_password_hash, verify_password

router = APIRouter()


class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    learning_style: Optional[str] = None
    role: Optional[str] = None


class PreferencesUpdateRequest(BaseModel):
    theme: Optional[str] = None


class APIKeyUpdateRequest(BaseModel):
    gemini_api_key: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


def _get_or_create_profile(user_id: int, db: Session) -> UserProfile:
    """Get or create a user profile."""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/profile")
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user profile."""
    profile = _get_or_create_profile(current_user.id, db)
    return {
        "email": current_user.email,
        "display_name": profile.display_name or "",
        "learning_style": profile.learning_style or "balanced",
        "role": current_user.role,
        "theme": profile.theme or "dark",
        "has_api_key": bool(profile.gemini_api_key),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user profile."""
    profile = _get_or_create_profile(current_user.id, db)
    if req.display_name is not None:
        profile.display_name = req.display_name
    if req.learning_style is not None:
        if req.learning_style not in ("visual", "reading", "practice", "balanced"):
            raise HTTPException(status_code=400, detail="Invalid learning style")
        profile.learning_style = req.learning_style
        
    if req.role is not None:
        if req.role not in ("student", "teacher", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        current_user.role = req.role
        
    db.commit()
    return {"message": "Profile updated"}


@router.put("/preferences")
def update_preferences(
    req: PreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user preferences."""
    profile = _get_or_create_profile(current_user.id, db)
    if req.theme is not None:
        if req.theme not in ("dark", "light"):
            raise HTTPException(status_code=400, detail="Invalid theme")
        profile.theme = req.theme
    db.commit()
    return {"message": "Preferences updated", "theme": profile.theme}


@router.put("/api-key")
def update_api_key(
    req: APIKeyUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update Gemini API key."""
    profile = _get_or_create_profile(current_user.id, db)
    profile.gemini_api_key = req.gemini_api_key
    db.commit()
    return {"message": "API key updated", "has_api_key": bool(req.gemini_api_key)}


@router.put("/password")
def change_password(
    req: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change password."""
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
