# 🎵 Tarang — AI Mood-to-Music Curator

> Describe your mood in words or speak it aloud. Tarang's Multi-Agent AI curates the perfect Hindi/Bollywood playlist to match your exact vibe, verified and ready to stream.

[![Python](https://img.shields.io/badge/Python-3.10+-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green)](https://flask.palletsprojects.com)
[![Google ADK](https://img.shields.io/badge/Google%20ADK-Multi--Agent-orange)](https://google.github.io/adk-docs)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.0%20Flash-purple)](https://ai.google.dev)
[![Deployed on Render](https://img.shields.io/badge/Deployed-Render.com-black)](https://render.com)

## 📌 Project Overview
Traditional music streaming platforms rely on rigid genres and historical data. They fail to capture hyper-specific emotional states (e.g., *"I need a song that feels like drinking cutting chai in the Mumbai rain while feeling nostalgic"*). 

**Tarang** (Hindi for "Wave/Vibe") solves this by using a **Google ADK Multi-Agent System** powered by **Gemini 2.0 Flash**. It analyzes natural language or voice descriptions of your mood, breaks down the emotional profile, and curates a highly specific 20-song YouTube playlist.

*Built for the Kaggle 5-Day AI Agents Intensive Capstone.*

---

## 🏆 Capstone Concepts Implemented

This project successfully implements the following Kaggle Capstone requirements:

1. **Multi-Agent System (Google ADK):** Refactored the backend into a specialized 3-agent pipeline (`OrchestratorAgent`, `EmotionAgent`, `MusicAgent`) for precise emotional profiling and music curation.
2. **Security Features:** Secured the application by completely isolating the Gemini API key in a `.env` file (excluded via `.gitignore`), configuring **Flask-CORS** to restrict API access to the frontend origin, and adding text sanitization across endpoints.
3. **Deployability:** Fully containerized and deployed live on Render.com with an HTTPS URL, which acts as a permanent fix for browser Web Speech API security restrictions.

---

## 🏗️ Architecture & Agent System

Tarang operates on a strict **3-Agent Pipeline** to ensure high-quality curation without LLM hallucinations:

```text
[User Voice/Text Input]
          │
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ 1️⃣ OrchestratorAgent (Manager)                        │
 │ Manages state, handles session memory, and routes data.│
 └────────┬───────────────────────────────────────────────┘
          │
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ 2️⃣ EmotionAgent (Psychologist)                        │
 │ Analyzes raw text -> Outputs structured JSON           │
 │ (Primary emotion, intensity, tempo preference, energy) │
 └────────┬───────────────────────────────────────────────┘
          │
          ▼
 ┌────────────────────────────────────────────────────────┐
 │ 3️⃣ MusicAgent (DJ)                                    │
 │ Takes Emotion JSON + Exclusions -> Curates 25 specific │
 │ Hindi tracks with poetic justifications.               │
 └────────┬───────────────────────────────────────────────┘
          │
          ▼
 [Parallel YouTube Verification Loop] -> Filters dead links
          │
          ▼
[Frontend UI & Continuous YouTube IFrame Player]
```

---

## ✨ Key Features

* **🎙️ "Always-On" Voice Assistant:** A Jarvis-style voice FSM (Passive -> Awake -> Executing) that listens for the *"Hey Tarang"* wake word using the browser's native Web Speech API.
* **🧠 Deep Emotion Parsing:** Doesn't just pick "sad" or "happy" songs—it evaluates intensity, tempo preference, and exact contextual cues.
* **🔄 Auto-Verification:** A parallel worker pool pings the YouTube API to guarantee that only playable, non-region-locked songs reach your queue.
* **🎵 Continuous Playback:** Custom JavaScript wrapper around the YouTube IFrame API auto-advances tracks to create a seamless radio experience.

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.10+
- A Google Gemini API Key (from [Google AI Studio](https://aistudio.google.com/))

### Local Development

**1. Clone the repository:**
```bash
git clone [https://github.com/yourusername/tarang-music.git](https://github.com/yourusername/tarang-music.git)
cd tarang-music
```

**2. Install dependencies:**
```bash
pip install -r requirements.txt
```

**3. Configure environment:**
Create a `.env` file in the root directory. **Never commit this file.**
```env
GEMINI_API_KEY=your_actual_api_key_here
FRONTEND_URL=http://localhost:3000
```

**4. Run the backend server:**
```bash
python server.py
```

**5. Open the app:** 
Navigate to `http://localhost:3000` in Google Chrome (Chrome is required for the native Web Speech API wake-word functionality).

---

## 📁 Project Structure

```text
tarang-music/
├── server.py          # Flask backend, CORS, Rate Limiting, API routes
├── agents.py          # Google ADK Multi-Agent pipeline
├── app.js             # Frontend logic, Voice FSM, YouTube Player
├── index.html         # User Interface
├── style.css          # Tailwind/Custom styling
├── requirements.txt   # Python dependencies
├── Procfile           # Render deployment configuration
├── .gitignore         # Git security exclusions
└── README.md          # Project documentation
```

---
*Created for the Kaggle Agentic AI Intensive 2026.*