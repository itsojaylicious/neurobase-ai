from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Classroom, ClassEnrollment, Lecture, ClassMaterial
from app.schemas import ClassroomCreate, ClassroomJoin, ClassroomResponse, MaterialCreate, MaterialResponse
import uuid

router = APIRouter()


# ═══════════════════════════════════════
# CLASSROOM CRUD
# ═══════════════════════════════════════

@router.post("/", response_model=ClassroomResponse)
def create_classroom(req: ClassroomCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Create a new classroom with subject and schedule."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can create classrooms")

    join_code = str(uuid.uuid4())[:8].upper()

    classroom = Classroom(
        teacher_id=current_user.id,
        name=req.name,
        subject=req.subject,
        description=req.description,
        schedule=req.schedule,
        join_code=join_code
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom


@router.post("/join", response_model=ClassroomResponse)
def join_classroom(req: ClassroomJoin, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Student: Join a classroom via join code."""
    classroom = db.query(Classroom).filter(Classroom.join_code == req.join_code).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found with this code")

    enrolled = db.query(ClassEnrollment).filter(
        ClassEnrollment.classroom_id == classroom.id,
        ClassEnrollment.student_id == current_user.id
    ).first()
    if enrolled:
        return classroom

    if current_user.id == classroom.teacher_id:
        raise HTTPException(status_code=400, detail="Teachers cannot enroll in their own classroom")

    enrollment = ClassEnrollment(classroom_id=classroom.id, student_id=current_user.id)
    db.add(enrollment)
    db.commit()
    return classroom


@router.get("/")
def get_classrooms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get classrooms — teachers see taught classes, students see enrolled."""
    if current_user.role in ("teacher", "admin"):
        teaching = db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()
        # Teachers can also be enrolled in other classes
        enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).all()
        class_ids = [e.classroom_id for e in enrollments]
        enrolled = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
        return {"teaching": teaching, "enrolled": enrolled}
    else:
        enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.student_id == current_user.id).all()
        class_ids = [e.classroom_id for e in enrollments]
        enrolled = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all() if class_ids else []
        return {"teaching": [], "enrolled": enrolled}


@router.get("/{classroom_id}")
def get_classroom_details(classroom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get classroom details including lectures, materials, students."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Check access
    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        enrolled = db.query(ClassEnrollment).filter(
            ClassEnrollment.classroom_id == classroom.id,
            ClassEnrollment.student_id == current_user.id
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this classroom")

    lectures = db.query(Lecture).filter(Lecture.classroom_id == classroom.id).order_by(Lecture.started_at.desc()).all()
    materials = db.query(ClassMaterial).filter(ClassMaterial.classroom_id == classroom.id).order_by(ClassMaterial.created_at.desc()).all()
    enrollments = db.query(ClassEnrollment).filter(ClassEnrollment.classroom_id == classroom.id).all()

    students = []
    for e in enrollments:
        student = db.query(User).filter(User.id == e.student_id).first()
        if student:
            students.append({"id": student.id, "email": student.email, "enrolled_at": e.enrolled_at.isoformat()})

    lecture_list = []
    for l in lectures:
        lecture_list.append({
            "id": l.id,
            "title": l.title,
            "is_live": l.is_live,
            "started_at": l.started_at.isoformat() if l.started_at else None,
            "ended_at": l.ended_at.isoformat() if l.ended_at else None,
            "detected_topics": l.detected_topics,
            "has_summary": bool(l.summary),
            "has_quiz": l.auto_quiz != "[]"
        })

    material_list = []
    for m in materials:
        material_list.append({
            "id": m.id, "title": m.title, "content": m.content,
            "material_type": m.material_type, "created_at": m.created_at.isoformat()
        })

    return {
        "id": classroom.id,
        "name": classroom.name,
        "subject": classroom.subject,
        "description": classroom.description,
        "schedule": classroom.schedule,
        "join_code": classroom.join_code,
        "teacher_id": classroom.teacher_id,
        "is_active": classroom.is_active,
        "lectures": lecture_list,
        "materials": material_list,
        "students": students,
        "student_count": len(students)
    }


@router.delete("/{classroom_id}")
def delete_classroom(classroom_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Delete a classroom."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(classroom)
    db.commit()
    return {"message": "Classroom deleted"}


# ═══════════════════════════════════════
# MATERIALS (pre-class uploads)
# ═══════════════════════════════════════

@router.post("/{classroom_id}/materials", response_model=MaterialResponse)
def add_material(classroom_id: int, req: MaterialCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Add pre-class material."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the teacher can add materials")

    material = ClassMaterial(
        classroom_id=classroom.id,
        title=req.title,
        content=req.content,
        material_type=req.material_type
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{classroom_id}/materials/{material_id}")
def delete_material(classroom_id: int, material_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teacher only: Delete a pre-class material."""
    material = db.query(ClassMaterial).filter(ClassMaterial.id == material_id, ClassMaterial.classroom_id == classroom_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if classroom.teacher_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(material)
    db.commit()
    return {"message": "Material deleted"}
