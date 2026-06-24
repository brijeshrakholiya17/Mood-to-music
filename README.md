# 🎵 Tarang — AI Mood-to-Music Curator

> Describe your mood in words or speak it. Gemini AI curates 20 perfectly matched Hindi songs, verified and ready to stream.

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green)](https://flask.palletsprojects.com)
[![Google ADK](https://img.shields.io/badge/Google%20ADK-Multi--Agent-orange)](https://google.github.io/adk-docs)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-purple)](https://ai.google.dev)

## 🤖 Agent Architecture (Google ADK)

Tarang uses a **3-agent pipeline** built with Google Agent Development Kit:
User Mood Text

↓

[OrchestratorAgent]

↓

[EmotionAgent] → Analyzes sentiment, energy, tempo preference

↓

[MusicAgent] → Curates 25 Hindi songs matching emotion profile

↓

YouTube Playability Verification (parallel)

↓

20 Verified Songs Ready to Play

## 🔒 Security Features

| Feature | Implementation |
|---|---|
| API Key Storage | `.env` file only — never in client code |
| CORS Protection | Restricted to known frontend origins only |
| Input Sanitization | All endpoints strip, length-limit, and XSS-clean inputs |
| Rate Limiting | 30 requests/minute on search endpoint |
| Audio Size Limit | 10MB max on voice endpoints |
| Git Protection | `.env` excluded via `.gitignore` |

## 🚀 Setup Instructions

### Prerequisites
- Python 3.10+
- Gemini API key from [aistudio.google.com](https://aistudio.google.dev)

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/tarang-music
cd tarang-music

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 4. Run the server
python server.py

# 5. Open browser
# Navigate to http://localhost:3000
```

### Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=https://your-deployed-url.onrender.com
```

**Never commit `.env` to version control.**

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, Tailwind CSS, YouTube IFrame API |
| Backend | Python, Flask, Flask-CORS, Flask-Limiter |
| AI Agents | Google ADK, Gemini 2.0 Flash |
| Voice | Web Speech API + Gemini Multimodal |
| Deployment | Render.com |

## 📁 Project Structure
tarang-music/

├── server.py          # Flask backend + API routes

├── agents.py          # Google ADK multi-agent system

├── app.js             # Frontend logic + Tarang voice assistant

├── index.html         # UI

├── style.css          # Styles

├── .env               # API keys (never committed)

├── .gitignore         # Excludes .env and secrets

├── requirements.txt   # Python dependencies

└── README.md          # This file

## 🎙️ Tarang Voice Assistant

Always-on Jarvis-style voice assistant with 3-state FSM:
- **PASSIVE** — continuously listens for "Hey Tarang" wake word
- **AWAKE** — actively listens for commands
- **EXECUTING** — performs action, returns to passive

Supported commands: curate mood, play/pause/next/random song, play specific song