import os
import re
from datetime import datetime
from typing import Dict, List
from uuid import uuid4

import torch
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.data_loader import clean_essay
from src.dataset import Vocab
from src.deep_model import EssayBiLSTM
from src.storage import append_grade_record

MODEL_PATH = os.getenv("MODEL_PATH", "models/deep_essay_grader.pt")
MAX_SEQ_LEN = int(os.getenv("MAX_SEQ_LEN", "300"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
GRADE_STORE_PATH = os.getenv("GRADE_STORE_PATH", "data/grades.json")

app = FastAPI(title="Essay Grader API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS.split(",")] if ALLOWED_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GradeRequest(BaseModel):
    submission_text: str = Field(..., min_length=20, strip_whitespace=True)
    student_name: str | None = None
    assignment_id: str | None = None


class GradeResponse(BaseModel):
    score: float
    normalized_score: float
    strengths: List[str]
    improvements: List[str]
    feedback: str
    metadata: Dict[str, float | int | str]


class GradeRecordRequest(BaseModel):
    student_name: str = Field(..., min_length=1)
    assignment_id: str = Field(..., min_length=1)
    grade: float = Field(..., ge=0, le=100)
    feedback: str = Field(..., min_length=5)
    evaluation: GradeResponse | None = None


class GradeRecordResponse(BaseModel):
    record_id: str
    saved_at: datetime
    student_name: str
    assignment_id: str
    grade: float
    feedback: str


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model: EssayBiLSTM | None = None
vocab: Vocab | None = None


def analyze_text_stats(text: str) -> Dict[str, float | int]:
    words = re.findall(r"[a-zA-Z']+", text)
    sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
    unique_words = len(set(words)) if words else 0

    return {
        "word_count": len(words),
        "sentence_count": len(sentences),
        "avg_sentence_length": (len(words) / len(sentences)) if sentences else len(words),
        "lexical_diversity": (unique_words / len(words)) if words else 0.0,
        "char_count": len(text),
    }


def build_strengths(stats: Dict[str, float | int]) -> List[str]:
    strengths: List[str] = []

    if stats["word_count"] >= 200:
        strengths.append("Submission provides thorough coverage of the topic.")
    if stats["avg_sentence_length"] >= 15:
        strengths.append("Ideas are developed with multi-clause sentences.")
    if stats["lexical_diversity"] >= 0.45:
        strengths.append("Writer uses a varied vocabulary.")
    if stats["sentence_count"] >= 8:
        strengths.append("Essay shows clear paragraph-like structure.")

    return strengths or ["Clear communication of core ideas."]


def build_improvements(stats: Dict[str, float | int]) -> List[str]:
    improvements: List[str] = []

    if stats["word_count"] < 150:
        improvements.append("Add more supporting details to reach the expected length.")
    if stats["avg_sentence_length"] < 12:
        improvements.append("Combine shorter sentences to improve coherence.")
    if stats["lexical_diversity"] < 0.35:
        improvements.append("Introduce more varied vocabulary to strengthen style.")
    if stats["sentence_count"] < 6:
        improvements.append("Organize thoughts into more complete paragraphs.")

    return improvements or ["Consider proofreading for grammar and clarity."]


def build_feedback(score: float, stats: Dict[str, float | int]) -> str:
    tone = "excellent" if score >= 85 else "solid" if score >= 70 else "developing"
    return (
        f"The essay demonstrates {tone} mastery with approximately {int(stats['word_count'])} words "
        f"spread across {int(stats['sentence_count'])} sentences. Maintain the current strengths while "
        f"addressing the suggested improvements to lift the score further."
    )


def load_artifacts() -> None:
    global model, vocab

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model checkpoint not found at '{MODEL_PATH}'. Train the model first or update MODEL_PATH."
        )

    checkpoint = torch.load(MODEL_PATH, map_location=device)
    vocab_dict = checkpoint.get("vocab")
    model_state = checkpoint.get("model_state")

    if not vocab_dict or not model_state:
        raise ValueError("Checkpoint is missing 'vocab' or 'model_state' keys.")

    vocab = Vocab()
    vocab.word2idx = vocab_dict
    vocab.idx2word = {idx: word for word, idx in vocab_dict.items()}

    model = EssayBiLSTM(vocab_size=len(vocab), embed_dim=100, hidden_dim=128, num_layers=2)
    model.load_state_dict(model_state)
    model.to(device)
    model.eval()


def infer_score(text: str) -> float:
    if model is None or vocab is None:
        raise RuntimeError("Model artifacts are not loaded.")

    cleaned = clean_essay(text)
    encoded = vocab.encode(cleaned)

    if len(encoded) < MAX_SEQ_LEN:
        encoded += [0] * (MAX_SEQ_LEN - len(encoded))
    else:
        encoded = encoded[:MAX_SEQ_LEN]

    tensor = torch.tensor([encoded], dtype=torch.long, device=device)
    with torch.no_grad():
        pred = model(tensor).item()

    # Clamp to scoring range
    return max(0.0, min(100.0, float(pred)))


@app.on_event("startup")
async def startup_event() -> None:
    try:
        load_artifacts()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Failed to load model artifacts: {exc}") from exc


@app.get("/healthz")
async def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/grade", response_model=GradeResponse)
async def grade_submission(payload: GradeRequest) -> GradeResponse:
    if not payload.submission_text.strip():
        raise HTTPException(status_code=400, detail="Submission text cannot be empty.")

    text = payload.submission_text.strip()
    stats = analyze_text_stats(text)

    try:
        raw_score = infer_score(text)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    normalized_score = round(raw_score, 2)
    strengths = build_strengths(stats)
    improvements = build_improvements(stats)
    feedback = build_feedback(normalized_score, stats)

    metadata: Dict[str, float | int | str] = {
        "student_name": payload.student_name or "",
        "assignment_id": payload.assignment_id or "",
        **stats,
    }

    return GradeResponse(
        score=normalized_score,
        normalized_score=normalized_score,
        strengths=strengths,
        improvements=improvements,
        feedback=feedback,
        metadata=metadata,
    )


@app.post("/api/grades", response_model=GradeRecordResponse, status_code=status.HTTP_201_CREATED)
async def save_grade(record: GradeRecordRequest) -> GradeRecordResponse:
    payload = record.dict()
    record_id = uuid4().hex
    saved_at = datetime.utcnow()

    to_store = {
        "record_id": record_id,
        "saved_at": saved_at.isoformat() + "Z",
        "student_name": payload["student_name"],
        "assignment_id": payload["assignment_id"],
        "grade": payload["grade"],
        "feedback": payload["feedback"],
        "evaluation": payload.get("evaluation"),
    }

    try:
        append_grade_record(to_store, GRADE_STORE_PATH)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to persist grade: {exc}") from exc

    return GradeRecordResponse(
        record_id=record_id,
        saved_at=saved_at,
        student_name=payload["student_name"],
        assignment_id=payload["assignment_id"],
        grade=payload["grade"],
        feedback=payload["feedback"],
    )

