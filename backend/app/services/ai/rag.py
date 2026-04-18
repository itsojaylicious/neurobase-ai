"""
RAG Engine — Retrieval-Augmented Generation with TF-IDF search (no C++ deps).
Searches user's uploaded documents + generated notes, then queries Gemini.
"""
import re
import math
from collections import Counter
from typing import List
from sqlalchemy.orm import Session
from app.db.models import Chunk, Subtopic, Topic
from app.services.ai import get_gemini_response



def tokenize(text: str) -> List[str]:
    """Basic word tokenization."""
    return re.findall(r'[a-zA-Z0-9]{2,}', text.lower())


def search_relevant_chunks(query: str, chunks: list, top_k: int = 8) -> list:
    """TF-IDF cosine similarity search — implemented from scratch."""
    if not chunks:
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return chunks[:top_k]

    # Tokenize all documents
    all_doc_tokens = [tokenize(c.text) for c in chunks]
    n = len(all_doc_tokens)

    # Compute document frequency
    df = Counter()
    for doc_tokens in all_doc_tokens:
        for token in set(doc_tokens):
            df[token] += 1

    # IDF scores
    idf = {t: math.log((n + 1) / (df[t] + 1)) + 1 for t in df}

    # Query TF
    query_tf = Counter(query_tokens)

    # Score each chunk via cosine similarity
    results = []
    for i, doc_tokens in enumerate(all_doc_tokens):
        if not doc_tokens:
            results.append((0, chunks[i]))
            continue

        doc_tf = Counter(doc_tokens)

        # Dot product
        dot = 0
        for token in query_tokens:
            if token in doc_tf:
                q_w = query_tf[token] * idf.get(token, 1)
                d_w = doc_tf[token] * idf.get(token, 1)
                dot += q_w * d_w

        # Norms
        q_norm = math.sqrt(sum((query_tf[t] * idf.get(t, 1)) ** 2 for t in query_tf)) or 1
        d_norm = math.sqrt(sum((doc_tf[t] * idf.get(t, 1)) ** 2 for t in doc_tf)) or 1

        score = dot / (q_norm * d_norm)
        results.append((score, chunks[i]))

    results.sort(key=lambda x: x[0], reverse=True)
    return [chunk for score, chunk in results[:top_k] if score > 0.01]


# ── CHUNKING ──

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """Split text into overlapping chunks for better retrieval."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def ingest_text_to_chunks(text: str, document_id: int, user_id: int, db: Session):
    """Chunk text and store in SQLite (user-scoped)."""
    docs = chunk_text(text)
    for i, chunk_txt in enumerate(docs):
        db_chunk = Chunk(document_id=document_id, user_id=user_id, text=chunk_txt, chunk_index=i)
        db.add(db_chunk)
    db.commit()


# ── RAG QUERY ──

class _VirtualChunk:
    """Wrapper to make subtopic content searchable alongside real chunks."""
    def __init__(self, text):
        self.text = text


def query_rag(query: str, user_id: int, db: Session) -> str:
    """RAG: Search user's chunks + generated notes, then query Gemini."""
    # Get user's chunks from uploaded documents
    user_chunks = db.query(Chunk).filter(Chunk.user_id == user_id).all()

    # Also search user's generated subtopic content
    user_subtopics = (
        db.query(Subtopic)
        .join(Topic)
        .filter(Topic.user_id == user_id, Subtopic.content.isnot(None))
        .all()
    )

    # Combine all searchable content
    all_searchable = list(user_chunks) + [
        _VirtualChunk(s.content) for s in user_subtopics if s.content
    ]

    if not all_searchable:
        # No personal data — use general knowledge
        prompt = f"""You are an intelligent AI tutor and learning assistant called NeuroBase AI.
The user has not uploaded any documents or generated any study material yet.
Answer the following question using your general knowledge. Be helpful, educational, and thorough.
Use markdown formatting with headers, bullet points, and code blocks where appropriate.

Question: {query}"""
        return get_gemini_response(prompt)

    # Semantic search for relevant chunks
    relevant = search_relevant_chunks(query, all_searchable, top_k=8)

    if not relevant:
        # No relevant chunks — fall back to general knowledge
        prompt = f"""You are an intelligent AI tutor called NeuroBase AI.
The user has documents in their knowledge base but none seem directly relevant to this question.
Answer using your general knowledge while being helpful and educational.
Use markdown formatting.

Question: {query}"""
        return get_gemini_response(prompt)

    context = "\n\n---\n\n".join([c.text for c in relevant])

    prompt = f"""You are an intelligent AI tutor and second brain assistant called NeuroBase AI.
Use the following pieces of retrieved context from the user's personal knowledge base to answer their question.
If the context is relevant, reference it. If you need to supplement with general knowledge, clearly say so.

Context from Knowledge Base:
{context}

Question: {query}

Provide a clear, educational answer with examples where helpful. Use markdown formatting with headers, bullet points, bold text, and code blocks where appropriate."""

    return get_gemini_response(prompt)
