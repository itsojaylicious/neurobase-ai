from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Document, Chunk
from app.services.ai.rag import ingest_text_to_chunks
import io
import pypdf

router = APIRouter()


@router.post("/")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF or TXT file. Extracts text, chunks it, and stores in knowledge base."""
    try:
        content = await file.read()
        extracted_text = ""

        if file.filename.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(content))
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    extracted_text += page_text + "\n"
        elif file.filename.endswith(".txt"):
            extracted_text = content.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

        # Create Document Record
        new_doc = Document(
            user_id=current_user.id,
            title=file.filename,
            content=extracted_text,
            source_type=file.filename.split('.')[-1]
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)

        # Chunk and store for RAG search
        ingest_text_to_chunks(extracted_text, new_doc.id, current_user.id, db)

        return {
            "id": new_doc.id,
            "filename": file.filename,
            "message": "Document processed and stored in Second Brain"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all documents uploaded by the current user."""
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return {
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "source_type": d.source_type,
                "created_at": d.created_at.isoformat(),
                "chunk_count": db.query(Chunk).filter(Chunk.document_id == d.id).count()
            }
            for d in docs
        ]
    }


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document and its chunks."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
