# Nexora

Nexora is a Flask learning app that uses Gemini to turn a subject and topic into a structured study package. A valid Gemini API key is required to generate content; the app does not fall back to mock responses.

## Run locally

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a valid key from Google AI Studio. Keep this file private and do not commit it.
4. Start the app:

   ```bash
   python app.py
   ```

5. Open http://127.0.0.1:5000.

## How it works

Enter a subject, topic, level, difficulty, objective, and learning style. A PDF or TXT file can be attached; files are parsed in memory and are not saved to disk. Gemini generates the six study sections and a five-question quiz. Each section can be regenerated independently; quiz grading runs locally and lists concepts associated with incorrect answers.

## Gemini integration

The Gemini integration is implemented in `ai_service.py`. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL` in your local `.env`; the browser only calls Flask endpoints and never receives the key. The service validates JSON output, labels source-derived information and generated examples, and asks Gemini to remain within the selected topic and learner settings. Quiz scoring stays server-side and deterministic. Do not commit `.env`.

## Project structure

```text
ai-studymate/
├── app.py                 # Flask routes, upload parsing, and per-session state
├── ai_service.py          # Gemini generation, response validation, and quiz scoring
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
├── templates/
│   ├── index.html
│   └── result.html
├── static/
│   ├── style.css
│   └── script.js
└── uploads/               # Reserved for uploads; files are not persisted
```