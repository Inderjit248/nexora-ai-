from datetime import datetime
import io
import json
import os
import re
import uuid

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from pypdf import PdfReader
from werkzeug.utils import secure_filename

import ai_service

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY") or os.urandom(32)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "txt", "png", "jpg", "jpeg", "webp", "gif", "bmp"}
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "bmp"}
MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "pdf": "application/pdf",
    "txt": "text/plain",
}

# The demo keeps each learner's package on the server, not in the browser cookie.
# Replace this in-memory store with a database if the app needs persistence.
study_sessions = {}
SAVED_PACKAGES_FILE = os.path.join(os.path.dirname(__file__), "saved_packages.json")


def load_saved_packages():
    """Load user saved learning packages from local JSON storage."""
    if os.path.exists(SAVED_PACKAGES_FILE):
        try:
            with open(SAVED_PACKAGES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def persist_saved_packages(packages):
    """Persist saved learning packages to disk."""
    try:
        with open(SAVED_PACKAGES_FILE, "w", encoding="utf-8") as f:
            json.dump(packages, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


STUDY_HISTORY_FILE = os.path.join(os.path.dirname(__file__), "study_history.json")


def load_study_history():
    """Load study history from local JSON storage."""
    if os.path.exists(STUDY_HISTORY_FILE):
        try:
            with open(STUDY_HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def persist_study_history(history):
    """Persist study history to disk."""
    try:
        with open(STUDY_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


def record_study_history(title, topic, subject, query, reply, entry_type="Study Query", metadata=None):
    """Append a study interaction or generated package to history."""
    try:
        history = load_study_history()
        date_str = datetime.now().strftime("%b %d, %Y • %I:%M %p")
        item = {
            "id": uuid.uuid4().hex[:10],
            "title": title or auto_detect_title(reply, topic),
            "topic": topic or "General Studies",
            "subject": subject or "General",
            "query": query or "",
            "reply": reply or "",
            "entry_type": auto_detect_content_type(reply, entry_type),
            "date": date_str,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {},
        }
        history.insert(0, item)
        history = history[:250]
        persist_study_history(history)
        return item
    except Exception:
        return None


def auto_detect_content_type(text, explicit_type=""):
    if explicit_type:
        return explicit_type
    lower = text.lower()
    if "pomodoro" in lower or "timetable" in lower or "daily schedule" in lower or "study block" in lower:
        return "Timetable / Schedule"
    if "flashcard" in lower or "q:" in lower and "a:" in lower:
        return "Flashcards"
    if "quiz" in lower or "multiple-choice" in lower or "question 1" in lower:
        return "Quiz & Questions"
    if "revision" in lower or "key takeaway" in lower or "summary" in lower:
        return "Revision Notes"
    return "Study Guide"


def auto_detect_title(text, topic="General Studies"):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:5]:
        if line.startswith("#"):
            cleaned = re.sub(r"^[#\s*📅📖📝📌🎯💡⚠️\d.:-]+", "", line).strip()
            if cleaned and len(cleaned) > 3:
                return cleaned[:80]
    return f"{topic} Study Guide"


def read_study_material(upload):
    """Read a supported upload (PDF, TXT, or Image) without keeping a copy on disk."""
    if not upload or not upload.filename:
        return "", "", None, ""

    filename = secure_filename(upload.filename) or "upload"
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Upload a PDF, TXT, PNG, JPG, or WEBP file.")

    content = upload.read()
    mime_type = MIME_MAP.get(extension, "application/octet-stream")
    text = ""
    raw_bytes = None

    if extension == "txt":
        text = content.decode("utf-8", errors="replace")
    elif extension == "pdf":
        raw_bytes = content
        try:
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            text = ""
    elif extension in IMAGE_EXTENSIONS:
        raw_bytes = content
        text = ""

    return filename, text[:25000], raw_bytes, mime_type


def current_study():
    return study_sessions.get(session.get("study_id"))


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/my-learning")
def my_learning():
    """Dashboard page displaying all user-saved learning packages."""
    packages = load_saved_packages()
    return render_template("my_learning.html", packages=packages)


@app.get("/api/saved-packages")
def get_saved_packages():
    """Return JSON list of saved learning packages."""
    packages = load_saved_packages()
    return jsonify(packages=packages)


@app.post("/api/saved-packages")
def save_package():
    """Save an AI study package to 'My Learning'."""
    payload = request.get_json(silent=True) or {}
    reply = payload.get("reply", "").strip()
    if not reply:
        return jsonify(error="No learning content to save."), 400

    topic = payload.get("topic", "").strip() or "General Studies"
    subject = payload.get("subject", "").strip() or "General"
    title = payload.get("title", "").strip() or auto_detect_title(reply, topic)
    content_type = auto_detect_content_type(reply, payload.get("content_type", "").strip())
    date_str = payload.get("date") or datetime.now().strftime("%b %d, %Y • %I:%M %p")

    new_pkg = {
        "id": uuid.uuid4().hex[:10],
        "title": title,
        "topic": topic,
        "subject": subject,
        "content_type": content_type,
        "reply": reply,
        "date": date_str,
    }

    packages = load_saved_packages()
    packages.insert(0, new_pkg)
    persist_saved_packages(packages)
    return jsonify(success=True, package=new_pkg)


@app.delete("/api/saved-packages/<pkg_id>")
def delete_saved_package(pkg_id):
    """Delete a saved learning package."""
    packages = load_saved_packages()
    initial_len = len(packages)
    packages = [p for p in packages if p.get("id") != pkg_id]
    if len(packages) < initial_len:
        persist_saved_packages(packages)
        return jsonify(success=True)
    return jsonify(error="Package not found"), 404


@app.get("/history")
def history_page():
    """Dashboard page displaying complete student study history."""
    history = load_study_history()
    return render_template("history.html", history=history)


@app.get("/api/history")
def get_study_history():
    """Return JSON list of study history entries."""
    history = load_study_history()
    return jsonify(history=history)


@app.post("/api/history")
def add_study_history():
    """Add a study history entry."""
    payload = request.get_json(silent=True) or {}
    reply = payload.get("reply", "").strip()
    query = payload.get("query", "").strip()
    topic = payload.get("topic", "").strip() or "General Studies"
    subject = payload.get("subject", "").strip() or "General"
    title = payload.get("title", "").strip() or auto_detect_title(reply or query, topic)
    entry_type = payload.get("entry_type", "Chat Query")

    item = record_study_history(
        title=title,
        topic=topic,
        subject=subject,
        query=query,
        reply=reply,
        entry_type=entry_type,
        metadata=payload.get("metadata"),
    )
    return jsonify(success=True, item=item)


@app.delete("/api/history/<item_id>")
def delete_history_item(item_id):
    """Delete a single history entry."""
    history = load_study_history()
    initial_len = len(history)
    history = [h for h in history if h.get("id") != item_id]
    if len(history) < initial_len:
        persist_study_history(history)
        return jsonify(success=True)
    return jsonify(error="History item not found"), 404


@app.delete("/api/history")
def clear_all_history():
    """Clear all study history entries."""
    persist_study_history([])
    return jsonify(success=True)


@app.post("/chat")
def chat():
    """AI chat assistant endpoint with full multimodal (text, PDF, image) support."""
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        message = payload.get("message", "").strip()
        history = payload.get("history", [])
        context_topic = payload.get("context_topic", "")
        filename, material, raw_bytes, mime_type = "", "", None, ""
    else:
        message = request.form.get("message", "").strip()
        try:
            history = json.loads(request.form.get("history", "[]"))
        except Exception:
            history = []
        context_topic = request.form.get("context_topic", "")
        try:
            filename, material, raw_bytes, mime_type = read_study_material(request.files.get("study_material"))
        except Exception as error:
            return jsonify(error=str(error)), 400

    if not message and not material and not raw_bytes:
        return jsonify(error="Ask Nexora a question, attach study notes, or paste/capture an image to begin."), 400

    try:
        reply_data = ai_service.chat_with_nexora(
            message=message or "Please review this attached study material and explain key concepts, solve questions, or provide summary notes.",
            history=history,
            context_topic=context_topic,
            material_text=material,
            material_name=filename,
            media_bytes=raw_bytes,
            media_mime_type=mime_type,
        )

        # Automatically record to study history
        record_study_history(
            title=auto_detect_title(reply_data.get("reply", ""), reply_data.get("active_topic", "General Studies")),
            topic=reply_data.get("active_topic", "General Studies"),
            subject=reply_data.get("active_subject", "General"),
            query=message or filename or "Attached study notes/material",
            reply=reply_data.get("reply", ""),
            entry_type=auto_detect_content_type(reply_data.get("reply", ""), "Chat Query"),
        )

        return jsonify(reply_data)
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503


@app.post("/generate")
def generate():
    try:
        filename, material, _, _ = read_study_material(request.files.get("study_material"))
    except (ValueError, Exception) as error:
        return render_template("index.html", error=str(error)), 400

    study_input = {
        "subject": request.form.get("subject", "").strip(),
        "topic": request.form.get("topic", "").strip(),
        "academic_level": request.form.get("academic_level", "School"),
        "difficulty": request.form.get("difficulty", "Beginner"),
        "objective": request.form.get("objective", "Understand concepts"),
        "learning_style": request.form.get("learning_style", "Simple explanation"),
        "material_name": filename,
        "study_material": material,
    }
    if not study_input["subject"] or not study_input["topic"]:
        return render_template("index.html", error="Add a subject and topic to continue."), 400

    try:
        package = ai_service.generate_learning_package(study_input)
    except ai_service.AIServiceError as error:
        return render_template("index.html", error=str(error)), 503

    study_id = uuid.uuid4().hex
    study_sessions[study_id] = {
        "input": study_input,
        "package": package,
        "quiz": None,
    }
    session["study_id"] = study_id
    return redirect(url_for("result"))


@app.get("/result")
def result():
    study = current_study()
    if not study:
        return redirect(url_for("index"))
    return render_template("result.html", study=study)


@app.post("/section")
def regenerate_section():
    study = current_study()
    payload = request.get_json(silent=True) or {}
    section = payload.get("section")
    if not study:
        return jsonify(error="Your study session has expired. Generate a new package."), 400
    if section not in study["package"]:
        return jsonify(error="That section is not available."), 400

    try:
        content = ai_service.generate_section(
            study["input"], section, simpler=bool(payload.get("simpler"))
        )
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503
    study["package"][section] = content
    return jsonify(section=section, content=content)


@app.post("/quiz")
def start_quiz():
    study = current_study()
    if not study:
        return jsonify(error="Your study session has expired. Generate a new package."), 400

    try:
        study["quiz"] = ai_service.generate_quiz(study["input"])
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503
    questions = [
        {key: value for key, value in question.items() if key not in {"answer", "explanation"}}
        for question in study["quiz"]
    ]
    return jsonify(questions=questions)


@app.post("/quiz/submit")
def submit_quiz():
    study = current_study()
    if not study or not study.get("quiz"):
        return jsonify(error="Start a new quiz before submitting answers."), 400

    payload = request.get_json(silent=True) or {}
    topic = payload.get("topic") or (study.get("input", {}).get("topic") if study else "")
    result_data = ai_service.evaluate_quiz(
        study["quiz"],
        payload.get("answers", []),
        topic=topic,
    )
    return jsonify(result_data)


@app.post("/api/quiz/generate")
def api_quiz_generate():
    """Generate topic-grounded 5 multiple-choice questions for interactive quiz."""
    payload = request.get_json(silent=True) or {}
    topic = payload.get("topic", "").strip() or "General Studies"
    subject = payload.get("subject", "").strip() or "General"
    material = payload.get("study_material", "")

    study_input = {
        "subject": subject,
        "topic": topic,
        "academic_level": payload.get("academic_level", "School"),
        "difficulty": payload.get("difficulty", "Beginner"),
        "objective": "Test understanding",
        "learning_style": "Multiple choice",
        "study_material": material,
    }

    try:
        questions = ai_service.generate_quiz(study_input)
        return jsonify(topic=topic, questions=questions)
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503
    except Exception as error:
        return jsonify(error=str(error)), 500


@app.post("/api/quiz/evaluate")
def api_quiz_evaluate():
    """Score submitted quiz answers and automatically generate mistake remediation."""
    payload = request.get_json(silent=True) or {}
    quiz = payload.get("quiz", [])
    answers = payload.get("answers", [])
    topic = payload.get("topic", "").strip() or "General Studies"

    if not quiz or not isinstance(quiz, list):
        return jsonify(error="No quiz questions provided."), 400

    try:
        result_data = ai_service.evaluate_quiz(quiz, answers, topic=topic)
        record_study_history(
            title=f"{topic} Quiz Score: {result_data['score']}/{result_data['total']}",
            topic=topic,
            subject="General",
            query=f"Completed {result_data['total']}-question quiz on {topic}",
            reply=f"Score: {result_data['score']}/{result_data['total']} ({round((result_data['score']/result_data['total'])*100)}%). Weak topics identified: {', '.join(result_data.get('weak_topics', []))}",
            entry_type="Quiz & Questions",
        )
        return jsonify(result_data)
    except Exception as error:
        return jsonify(error=str(error)), 500


@app.post("/api/study-path")
def api_study_path():
    """Generate dynamic AI Study Path showing Strong 🟢, Improving 🟡, Weak 🔴, and Next Topic."""
    payload = request.get_json(silent=True) or {}
    covered_topics = payload.get("covered_topics", [])
    quiz_history = payload.get("quiz_history", [])
    weak_concepts = payload.get("weak_concepts", [])

    try:
        path_data = ai_service.generate_study_path(
            covered_topics=covered_topics,
            quiz_history=quiz_history,
            weak_concepts=weak_concepts,
        )
        return jsonify(path_data)
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503
    except Exception as error:
        return jsonify(error=str(error)), 500


@app.post("/api/quick-revision")
def api_quick_revision():
    """Generate a focused 5, 10, or 20-minute quick revision session targeting weak areas."""
    payload = request.get_json(silent=True) or {}
    topic = payload.get("topic", "").strip() or "General Studies"
    duration = payload.get("duration", "10m")
    weak_areas = payload.get("weak_areas", [])
    material = payload.get("study_material", "")

    try:
        revision_data = ai_service.generate_quick_revision(
            topic=topic,
            duration=duration,
            weak_areas=weak_areas,
            material_text=material,
        )
        record_study_history(
            title=f"{topic} {duration} Quick Revision",
            topic=topic,
            subject="General",
            query=f"Requested {duration} quick revision targeting weak areas",
            reply=revision_data.get("revision_content", ""),
            entry_type="Revision Notes",
        )
        return jsonify(revision_data)
    except ai_service.AIServiceError as error:
        return jsonify(error=str(error)), 503
    except Exception as error:
        return jsonify(error=str(error)), 500


@app.post("/api/regenerate-section")
def api_regenerate_section():
    """Regenerate a single section of a learning package without changing others."""
    payload = request.get_json(silent=True) or {}
    section = payload.get("section", "explanation").lower()
    topic = payload.get("topic", "").strip() or "General Studies"
    subject = payload.get("subject", "").strip() or "General"
    simpler = bool(payload.get("simpler", False))
    material = payload.get("study_material", "")

    # Map aliases
    alias_map = {
        "explanation": "learn",
        "learn": "learn",
        "concepts": "concepts",
        "important concepts": "concepts",
        "examples": "examples",
        "real-world examples": "examples",
        "practice": "practice",
        "practice questions": "practice",
        "questions": "practice",
        "flashcards": "flashcards",
        "revision": "revision",
        "revision plan": "revision",
    }
    canonical_section = alias_map.get(section, "learn")

    study_input = {
        "subject": subject,
        "topic": topic,
        "academic_level": payload.get("academic_level", "School"),
        "difficulty": payload.get("difficulty", "Beginner"),
        "objective": "Understand concepts",
        "learning_style": "Simple explanation",
        "study_material": material,
    }

    try:
        content = ai_service.generate_section(study_input, canonical_section, simpler=simpler)
        return jsonify(section=canonical_section, content=content, topic=topic)
    except Exception:
        # Fallback to chat generation for this specific section
        section_name_readable = canonical_section.capitalize()
        prompt = (
            f"Regenerate only the {section_name_readable} section for the topic '{topic}' ({subject}). "
            f"{'Use even simpler, more accessible language. ' if simpler else ''}"
            f"Provide labeled source tags (📘 [From Your Study Material], ✨ [AI Generated], 💡 [AI Example])."
        )
        try:
            reply_data = ai_service.chat_with_nexora(
                message=prompt,
                context_topic=topic,
                material_text=material,
            )
            return jsonify(section=canonical_section, content=reply_data.get("reply", ""), topic=topic)
        except Exception as error:
            return jsonify(error=str(error)), 503


@app.errorhandler(413)
def upload_too_large(_error):
    return render_template("index.html", error="Files must be smaller than 5 MB."), 413


if __name__ == "__main__":
    app.run(debug=True)