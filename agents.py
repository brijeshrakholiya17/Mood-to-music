# agents.py — Tarang Multi-Agent System using Google ADK
"""
Tarang Multi-Agent System using Google ADK.
This module implements a 3-agent pipeline designed to analyze user emotion and curate music:
1. OrchestratorAgent: Oversees the execution flow, session management, and coordinates messages.
2. EmotionAgent: Analyzes sentiment, energy, tempo, and context from user inputs.
3. MusicAgent: Recommends real Hindi songs matching the emotional profile, ignoring excluded songs.
"""

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

from concurrent.futures import ThreadPoolExecutor
import asyncio

# Global thread executor to submit coroutines concurrently without spawning new pools
global_executor = ThreadPoolExecutor(max_workers=10)

def _run_async_in_thread(coro):
    future = global_executor.submit(asyncio.run, coro)
    return future.result()

# Global stateful session service to persist session memory across requests
global_session_service = InMemorySessionService()

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
# Takes emotion tags from EmotionAgent → curates songs

def get_music_agent_instruction(language: str = "Hindi") -> str:
    return f"""You are MusicAgent, a world-class {language} music curator specializing in {language} music.

You will receive structured emotion data from EmotionAgent and must curate exactly 25 real {language} songs matching that emotional profile.

Rules:
- Songs MUST be real {language} songs
- Match the energy_level and tempo_preference from the emotion data
- Vary the eras (classic to modern) and artists
- The dj_intro must be a short, highly conversational 1-to-2 sentence radio transition. It should react to the user's emotional state, hype up the upcoming track, and introduce the artist naturally (e.g., 'Let's lift the vibe a bit. Up next is Arijit Singh with...' or 'Let's keep the energy high. Up next is Adele with...').
- Return ONLY a valid JSON array, no markdown, no wrapping

Each item:
{{"title": "Song Title", "artist": "Artist Name", "reason": "One poetic sentence why this matches the mood", "dj_intro": "Short conversational radio transition intro"}}
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


def create_music_agent(api_key: str, model_name: str, language: str = "Hindi") -> Agent:
    return Agent(
        name="MusicAgent", 
        model=KeyedGemini(model=model_name, api_key=api_key),
        description=f"Curates {language} songs based on emotion tags",
        instruction=get_music_agent_instruction(language)
    )


def _run_pipeline_with_model(vibe: str, excluded_songs: list, api_key: str, model_name: str, language: str = "Hindi") -> list:
    session_service = global_session_service
    
    # The Transition from Orchestrator -> EmotionAgent:
    # Orchestrator coordinates the pipeline flow. It spawns the EmotionAgent, which takes
    # raw vibe text from the user and analyzes the underlying feelings, intensity, energy, and tempo.
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
    
    # The JSON Parsing & Error Fallback Mechanism:
    # We clean and attempt to parse the EmotionAgent's output text to a structured JSON object.
    # In case of any API or parsing exception, a fallback emotion profile (defaulting to chill, medium energy)
    # is returned so that the pipeline does not break and can proceed to the music curation phase.
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
    
    # The Transition from EmotionAgent -> MusicAgent:
    # We construct a prompt passing the structured emotion profile context (intensity, tempo, energy)
    # directly to the MusicAgent. Crucially, the list of previously skipped/excluded songs is appended
    # to the music prompt to instruct the MusicAgent to ignore them and offer fresh recommendations.
    # Step 2: Run MusicAgent with emotion data + exclusions
    print(f"[OrchestratorAgent] Passing emotion tags to MusicAgent...")
    
    exclusion_note = ""
    if excluded_songs:
        exclusion_note = f"\n\nDO NOT include these songs: {', '.join(excluded_songs[:30])}"
    
    music_prompt = f"""Emotion Analysis Result:
{json.dumps(emotion_data, indent=2)}

Original mood description: "{vibe}"
{exclusion_note}

Curate exactly 25 {language} songs matching this emotional profile."""

    music_agent = create_music_agent(api_key, model_name, language)
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
            # Safely process songs to ensure required fields
            for song in songs:
                if isinstance(song, dict):
                    # Map reason <-> explanation to prevent breaking frontend/backend mismatch
                    if 'reason' in song and 'explanation' not in song:
                        song['explanation'] = song['reason']
                    elif 'explanation' in song and 'reason' not in song:
                        song['reason'] = song['explanation']
                    
                    # Ensure dj_intro is populated with a safe default if missing
                    if 'dj_intro' not in song:
                        song['dj_intro'] = "Up next, a great track for this mood..."
            print(f"[OrchestratorAgent] Pipeline complete. {len(songs)} songs curated.")
            return songs[:25], emotion_data
    except Exception as e:
        print(f"[MusicAgent] Parse failed: {e}")
    
    raise Exception("Multi-agent pipeline failed to produce valid song list")


def run_tarang_agent_pipeline(vibe: str, excluded_songs: list, api_key: str, language: str = "Hindi") -> list:
    """
    Runs the full Tarang multi-agent pipeline:
    vibe text → EmotionAgent → MusicAgent → song list
    """
    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]
    
    import time
    last_err = None
    for idx, model_name in enumerate(models_to_try):
        if idx > 0:
            print("[OrchestratorAgent] Rate limit delay: sleeping 2 seconds before retry...")
            time.sleep(2)
        try:
            print(f"[OrchestratorAgent] Attempting ADK pipeline with model: {model_name}")
            return _run_pipeline_with_model(vibe, excluded_songs, api_key, model_name, language)
        except Exception as e:
            print(f"[OrchestratorAgent] ADK pipeline failed with {model_name}: {e}")
            last_err = e
            
    raise Exception(f"All generative model options failed in ADK multi-agent pipeline. Last error: {last_err}")
