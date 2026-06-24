# agents.py — Tarang Multi-Agent System using Google ADK

import json
import os
import re
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import Client, types
from google.adk.models import Gemini

# Custom Gemini subclass to support passing key per request in ADK agents
class KeyedGemini(Gemini):
    api_key: str

    @property
    def api_client(self) -> Client:
        return Client(api_key=self.api_key)

    @property
    def _live_api_client(self) -> Client:
        return Client(api_key=self.api_key)

def _run_async_in_thread(coro):
    from concurrent.futures import ThreadPoolExecutor
    import asyncio
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(asyncio.run, coro)
        return future.result()

# ── Agent 1: EmotionAgent ──────────────────────────────────────────────────
# Takes raw mood text → returns structured emotion tags + intensity

EMOTION_AGENT_INSTRUCTION = """
You are EmotionAgent, a specialist in analyzing human emotional states from text descriptions.

When given a mood description, you must analyze it and return ONLY a valid JSON object with this exact structure:
{
  "primary_emotion": "one of: happy, sad, cozy, chill, hype, focus, romantic, nostalgic, anxious, peaceful",
  "secondary_emotions": ["list", "of", "2-3", "supporting", "emotions"],
  "intensity": 0.0 to 1.0,
  "energy_level": "low | medium | high",
  "tempo_preference": "slow | moderate | fast",
  "mood_keywords": ["3-5", "keywords", "from", "the", "description"],
  "context": "one sentence describing the situation/setting"
}

Return ONLY the JSON. No explanation. No markdown.
"""

# ── Agent 2: MusicAgent ───────────────────────────────────────────────────
# Takes emotion tags from EmotionAgent → curates Hindi songs

MUSIC_AGENT_INSTRUCTION = """
You are MusicAgent, a world-class Hindi music curator specializing in Bollywood and Indian indie music.

You will receive structured emotion data from EmotionAgent and must curate exactly 25 real Hindi songs matching that emotional profile.

Rules:
- Songs MUST be real Hindi/Bollywood/Hindi-indie songs
- Match the energy_level and tempo_preference from the emotion data
- Vary the eras (classic to modern) and artists
- Return ONLY a valid JSON array, no markdown, no wrapping

Each item:
{"title": "Song Title", "artist": "Artist Name", "explanation": "One poetic sentence why this matches the mood"}
"""

# ── Agent 3: OrchestratorAgent ────────────────────────────────────────────
# Coordinates EmotionAgent and MusicAgent, manages the pipeline state

ORCHESTRATOR_INSTRUCTION = """
You are OrchestratorAgent for Tarang, an AI mood-to-music system.

Your job is to coordinate a two-step pipeline:
1. First call EmotionAgent with the user's mood text to get structured emotion analysis
2. Then call MusicAgent with those emotion tags to get curated songs
3. Return the final combined result

You manage state between agents and ensure the pipeline completes successfully.
"""


def _clean_and_parse_json(text: str):
    if not text:
        raise ValueError("Empty text input")
    text_clean = text.strip()
    # Strip markdown backticks if present
    if text_clean.startswith("```"):
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", text_clean, re.DOTALL)
        if match:
            text_clean = match.group(1).strip()
    
    try:
        return json.loads(text_clean)
    except json.JSONDecodeError:
        start_brace = text_clean.find('{')
        start_bracket = text_clean.find('[')
        
        start = -1
        end = -1
        if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
            start = start_brace
            end = text_clean.rfind('}')
        elif start_bracket != -1:
            start = start_bracket
            end = text_clean.rfind(']')
            
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text_clean[start:end+1].strip())
            except json.JSONDecodeError as err:
                raise ValueError(f"Regex boundary parsing failed: {err}")
        raise

def create_emotion_agent(api_key: str, model_name: str) -> Agent:
    return Agent(
        name="EmotionAgent",
        model=KeyedGemini(model=model_name, api_key=api_key),
        description="Analyzes mood text and returns structured emotion tags",
        instruction=EMOTION_AGENT_INSTRUCTION
    )


def create_music_agent(api_key: str, model_name: str) -> Agent:
    return Agent(
        name="MusicAgent", 
        model=KeyedGemini(model=model_name, api_key=api_key),
        description="Curates Hindi songs based on emotion tags",
        instruction=MUSIC_AGENT_INSTRUCTION
    )


def _run_pipeline_with_model(vibe: str, excluded_songs: list, api_key: str, model_name: str) -> list:
    session_service = InMemorySessionService()
    
    # Step 1: Run EmotionAgent
    print(f"[OrchestratorAgent] Starting pipeline for vibe: '{vibe[:50]}...'")
    
    emotion_agent = create_emotion_agent(api_key, model_name)
    emotion_runner = Runner(
        agent=emotion_agent,
        app_name="tarang_emotion",
        session_service=session_service
    )
    
    session_id = f"emotion_{hash(vibe) % 99999}"
    user_id = "tarang_user"
    
    _run_async_in_thread(session_service.create_session(
        app_name="tarang_emotion",
        user_id=user_id,
        session_id=session_id
    ))
    
    emotion_result_text = ""
    emotion_message = types.Content(
        role="user",
        parts=[types.Part(text=vibe)]
    )
    
    for event in emotion_runner.run(
        user_id=user_id,
        session_id=session_id,
        new_message=emotion_message
    ):
        if event.is_final_response() and event.content and event.content.parts:
            emotion_result_text = event.content.parts[0].text
            break
    
    print(f"[EmotionAgent] Result: {emotion_result_text[:100]}")
    
    # Parse emotion result
    try:
        emotion_data = _clean_and_parse_json(emotion_result_text)
    except Exception as e:
        print(f"[EmotionAgent] Parse failed, using fallback: {e}")
        emotion_data = {
            "primary_emotion": "chill",
            "intensity": 0.5,
            "energy_level": "medium",
            "tempo_preference": "moderate",
            "mood_keywords": vibe.split()[:5],
            "context": vibe
        }
    
    # Step 2: Run MusicAgent with emotion data + exclusions
    print(f"[OrchestratorAgent] Passing emotion tags to MusicAgent...")
    
    exclusion_note = ""
    if excluded_songs:
        exclusion_note = f"\n\nDO NOT include these songs: {', '.join(excluded_songs[:30])}"
    
    music_prompt = f"""Emotion Analysis Result:
{json.dumps(emotion_data, indent=2)}

Original mood description: "{vibe}"
{exclusion_note}

Curate exactly 25 Hindi songs matching this emotional profile."""

    music_agent = create_music_agent(api_key, model_name)
    music_runner = Runner(
        agent=music_agent,
        app_name="tarang_music",
        session_service=session_service
    )
    
    music_session_id = f"music_{hash(vibe) % 99999}"
    _run_async_in_thread(session_service.create_session(
        app_name="tarang_music",
        user_id=user_id,
        session_id=music_session_id
    ))
    
    music_message = types.Content(
        role="user",
        parts=[types.Part(text=music_prompt)]
    )
    
    music_result_text = ""
    for event in music_runner.run(
        user_id=user_id,
        session_id=music_session_id,
        new_message=music_message
    ):
        if event.is_final_response() and event.content and event.content.parts:
            music_result_text = event.content.parts[0].text
            break
    
    print(f"[MusicAgent] Received {len(music_result_text)} chars of song data")
    
    # Parse music result
    try:
        songs = _clean_and_parse_json(music_result_text)
        if isinstance(songs, list) and len(songs) > 0:
            print(f"[OrchestratorAgent] Pipeline complete. {len(songs)} songs curated.")
            return songs[:25], emotion_data
    except Exception as e:
        print(f"[MusicAgent] Parse failed: {e}")
    
    raise Exception("Multi-agent pipeline failed to produce valid song list")


def run_tarang_agent_pipeline(vibe: str, excluded_songs: list, api_key: str) -> list:
    """
    Runs the full Tarang multi-agent pipeline:
    vibe text → EmotionAgent → MusicAgent → song list
    """
    # Order models by reliability/quota limits. Lite has higher free-tier limits.
    models_to_try = [
        "gemini-2.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    
    last_err = None
    for model_name in models_to_try:
        try:
            print(f"[OrchestratorAgent] Attempting ADK pipeline with model: {model_name}")
            return _run_pipeline_with_model(vibe, excluded_songs, api_key, model_name)
        except Exception as e:
            print(f"[OrchestratorAgent] ADK pipeline failed with {model_name}: {e}")
            last_err = e
            
    raise Exception(f"All generative model options failed in ADK multi-agent pipeline. Last error: {last_err}")
