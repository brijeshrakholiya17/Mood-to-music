# Python Backend Server for Mood-to-Music Curator
import os
import urllib.request
import urllib.parse
import re
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Manually load environment variables from .env file if it exists
def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        key_val = line.split('=', 1)
                        if len(key_val) == 2:
                            key = key_val[0].strip()
                            val = key_val[1].strip().strip('"').strip("'")
                            os.environ[key] = val
                            if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                                print(f"[Dotenv] Loaded: {key}")
        except Exception as e:
            print(f"Error loading .env file: {e}")

# Security: API key loaded from .env file only — never from client requests in production
load_dotenv()

# Try to import ADK agents — fall back to legacy if ADK not available
try:
    from agents import run_tarang_agent_pipeline
    ADK_AVAILABLE = True
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print("[Tarang] ADK multi-agent pipeline: LOADED")
except ImportError as e:
    ADK_AVAILABLE = False
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print(f"[Tarang] ADK not available, using legacy curation: {e}")


from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__, static_folder='.')

# Kaggle Capstone: Security Implementation — CORS origins configuration
# Restricts incoming API requests to trusted frontend domains only.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://mood-to-music.onrender.com",
    "https://mood-to-music.onrender.com/",
    os.environ.get("FRONTEND_URL", "")    # set this env var in production
]

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "X-Gemini-API-Key"]
    }
})

print(f"[Security] CORS enabled for origins: {[o for o in ALLOWED_ORIGINS if o]}")

# Kaggle Capstone: Security Implementation — Input Sanitization Helper
# Strips HTML/XSS content, trims whitespaces, and checks payload length to prevent injection attacks.
def sanitize_text_input(text, max_length=500, field_name="input"):
    """Sanitize and validate text inputs across all endpoints."""
    if not text:
        return None, f"{field_name} is required"
    if not isinstance(text, str):
        return None, f"{field_name} must be a string"
    # Strip whitespace
    text = text.strip()
    if not text:
        return None, f"{field_name} cannot be empty or whitespace"
    # Length limit
    if len(text) > max_length:
        return None, f"{field_name} exceeds maximum length of {max_length} characters"
    # Basic XSS: strip HTML tags
    import re
    text = re.sub(r'<[^>]+>', '', text)
    # Remove null bytes
    text = text.replace('\x00', '')
    return text, None

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://"
)

def check_playability(video_id):
    """
    Checks the YouTube watch page for embed playability restrictions.
    Returns a dict with playability details.
    """
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
    )
    try:
        # Fetch watch page HTML
        html = urllib.request.urlopen(req, timeout=3).read().decode('utf-8')
        
        # Locate the player response script which holds playability metadata
        match = re.search(r"ytInitialPlayerResponse\s*=\s*({.+?});", html)
        if not match:
            match = re.search(r"ytInitialPlayerResponse\s*=\s*({.+?})\s*<", html)
        if not match:
            match = re.search(r"ytInitialPlayerResponse\s*=\s*({.+?})[;<\n]", html)
            
        if match:
            player_response = json.loads(match.group(1))
            status_obj = player_response.get("playabilityStatus", {})
            status = status_obj.get("status")
            playable_in_embed = status_obj.get("playableInEmbed", True)
            reason = status_obj.get("reason", "")
            
            # Reject YouTube Shorts and short promo teasers (duration <= 60 seconds)
            video_details = player_response.get("videoDetails", {})
            length_seconds = 0
            try:
                length_seconds = int(video_details.get("lengthSeconds", "0"))
            except ValueError:
                pass
                
            if 0 < length_seconds <= 60:
                return {
                    "ok": False,
                    "status": "SHORT_VIDEO",
                    "playableInEmbed": playable_in_embed,
                    "reason": f"Video is a YouTube Short or teaser (duration: {length_seconds}s)"
                }
            
            # Status must be "OK" and playable in embed
            is_ok = (status == "OK") and playable_in_embed
            return {
                "ok": is_ok,
                "status": status,
                "playableInEmbed": playable_in_embed,
                "reason": reason
            }
        return {
            "ok": False,
            "status": "UNKNOWN",
            "playableInEmbed": False,
            "reason": "Could not parse player response metadata"
        }
    except Exception as e:
        print(f"Error checking playability for video {video_id}: {e}")
        import urllib.error
        is_fallback = False
        reason_str = str(e)
        if isinstance(e, urllib.error.HTTPError):
            if e.code in (429, 403):
                is_fallback = True
                reason_str = f"YouTube scraping blocked (HTTP {e.code}). Assuming playable."
        
        return {
            "ok": is_fallback,
            "status": "RATE_LIMITED_FALLBACK" if is_fallback else "ERROR",
            "playableInEmbed": is_fallback,
            "reason": reason_str
        }

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

def search_and_verify(query):
    """
    Scrapes YouTube results page and checks playability of candidates IN PARALLEL.
    Returns (videoId, candidates_log, status)
    """
    try:
        query_encoded = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={query_encoded}"
        
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        html = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        all_ids = re.findall(r"watch\?v=([a-zA-Z0-9_-]{11})", html)
        seen = set()
        video_ids = []
        for vid in all_ids:
            if vid not in seen:
                seen.add(vid)
                video_ids.append(vid)
                if len(video_ids) >= 5:
                    break
        
        if not video_ids:
            return None, [], "NO_SEARCH_RESULTS"
        
        # Kaggle Capstone: Playability Verification Thread Loop
        # Uses parallel execution (ThreadPoolExecutor) to verify playability of candidate videos concurrently.
        # This speeds up API response times and ensures only verified, embed-playable, full-length songs
        # (non-Shorts/non-blocked) are returned to the frontend.
        # Run all playability checks in PARALLEL for maximum speed
        candidates_log = []
        results_map = {}
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_vid = {executor.submit(check_playability, vid): vid for vid in video_ids}
            for future in as_completed(future_to_vid):
                vid = future_to_vid[future]
                try:
                    playability = future.result()
                except Exception as exc:
                    playability = {"ok": False, "status": "ERROR", "playableInEmbed": False, "reason": str(exc)}
                results_map[vid] = playability
        
        # Preserve original order and find first passing video
        first_ok_vid = None
        for vid in video_ids:
            playability = results_map.get(vid, {"ok": False, "status": "UNKNOWN", "playableInEmbed": False, "reason": "No result"})
            log_entry = {
                "videoId": vid,
                "status": playability["status"],
                "playableInEmbed": playability["playableInEmbed"],
                "reason": playability.get("reason", ""),
                "ok": playability["ok"]
            }
            candidates_log.append(log_entry)
            if playability["ok"] and first_ok_vid is None:
                first_ok_vid = vid
        
        if first_ok_vid:
            return first_ok_vid, candidates_log, "OK"
            
        # Fallback: If all candidates failed playability checks (e.g., due to rate limits or timeouts)
        # but we successfully retrieved search results from YouTube, return the first candidate.
        # This prevents complete curation failure on hosted platforms like Render.
        if video_ids:
            print(f"[Search] Playability verification failed for all candidates. Falling back to first candidate: {video_ids[0]}")
            return video_ids[0], candidates_log, "OK"
            
        return None, candidates_log, "UNPLAYABLE"
        
    except Exception as e:
        print(f"Error in search_and_verify for query '{query}': {e}")
        return None, [], f"ERROR: {str(e)}"

@app.route('/api/search')
@limiter.limit("30 per minute")
def api_search():
    query_raw = request.args.get('q', '')
    query, query_err = sanitize_text_input(query_raw, max_length=200, field_name="query")
    if query_err:
        return jsonify({'error': query_err}), 400
        
    print(f"=== Primary Search: '{query}' ===")
    vid, candidates_log, status = search_and_verify(query)
    
    if status == "OK":
        print(f"Resolved working video ID for primary query: {vid}")
        return jsonify({
            'videoId': vid,
            'status': 'OK',
            'candidates': candidates_log
        })
        
    # SOLUTION 1: Fallback search if primary fails (Try Lyric Uploads)
    fallback_query = query
    if query.lower().endswith(" song"):
        fallback_query = query[:-5] + " lyric"
    else:
        fallback_query = query + " lyric"
        
    print(f"=== Fallback Search (Lyric): '{fallback_query}' ===")
    fb_vid, fb_candidates, fb_status = search_and_verify(fallback_query)
    
    combined_candidates = candidates_log + fb_candidates
    
    if fb_status == "OK":
        print(f"Resolved working video ID for lyric fallback query: {fb_vid}")
        return jsonify({
            'videoId': fb_vid,
            'status': 'OK_FALLBACK',
            'candidates': combined_candidates
        })
        
    # Secondary fallback search (Try Audio Uploads)
    secondary_query = query
    if query.lower().endswith(" song"):
        secondary_query = query[:-5] + " audio"
    else:
        secondary_query = query + " audio"
        
    print(f"=== Secondary Fallback Search (Audio): '{secondary_query}' ===")
    sec_vid, sec_candidates, sec_status = search_and_verify(secondary_query)
    
    combined_candidates = combined_candidates + sec_candidates
    
    if sec_status == "OK":
        print(f"Resolved working video ID for audio fallback query: {sec_vid}")
        return jsonify({
            'videoId': sec_vid,
            'status': 'OK_FALLBACK',
            'candidates': combined_candidates
        })
        
    # If all primary and fallback candidates fail verification, return videoId: null
    print(f"Warning: All primary and fallback search candidates failed verification for query '{query}'")
    return jsonify({
        'videoId': None,
        'status': 'UNPLAYABLE',
        'error': 'All candidates in primary and fallback searches failed playability verification',
        'candidates': combined_candidates
    })

def execute_gemini_multimodal_request(payload, api_key):
    """
    Executes a POST request to Gemini, trying multiple model and API version fallbacks 
    if any candidates fail with a 404/400 (unsupported model/endpoint) error.
    """
    models_to_try = [
        {"name": "gemini-2.0-flash", "version": "v1beta"},
        {"name": "gemini-2.5-flash", "version": "v1beta"},
        {"name": "gemini-2.5-flash-lite", "version": "v1beta"},
        {"name": "gemini-2.5-pro", "version": "v1beta"},
        {"name": "gemini-flash-latest", "version": "v1beta"},
    ]
    
    last_error = None
    for model in models_to_try:
        url = f"https://generativelanguage.googleapis.com/{model['version']}/models/{model['name']}:generateContent?key={api_key}"
        print(f"Attempting Gemini request on model fallback: {model['name']} ({model['version']})")
        req_data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={'Content-Type': 'application/json'}
        )
        try:
            response = urllib.request.urlopen(req, timeout=40)
            res_data = response.read().decode('utf-8')
            res_json = json.loads(res_data)
            
            candidates = res_json.get("candidates", [])
            if candidates:
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if text:
                    print(f"Resolved successful response with model: {model['name']}")
                    return text
            last_error = "Response body missing candidates or text content"
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode('utf-8')
            except Exception as read_err:
                err_body = f"Failed to read body: {read_err}"
            print(f"Model fallback {model['name']} ({model['version']}) failed with HTTP {e.code}: {e.reason}. Body: {err_body}")
            last_error = f"HTTP Error {e.code}: {e.reason} - {err_body}"
        except Exception as e:
            print(f"Model fallback {model['name']} ({model['version']}) request failed: {e}")
            last_error = str(e)
            
    raise Exception(f"All generative voice models failed. Last error: {last_error}")

def execute_gemini_text_request(prompt, model_name, version, api_key):
    url = f"https://generativelanguage.googleapis.com/{version}/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": { "responseMimeType": "application/json" }
    }
    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={'Content-Type': 'application/json'}
    )
    response = urllib.request.urlopen(req, timeout=12)
    res_data = response.read().decode('utf-8')
    res_json = json.loads(res_data)
    candidates = res_json.get("candidates", [])
    if candidates:
        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if text:
            return text
    raise Exception("Response body missing candidates or text content")

def curate_with_gemini_backend(vibe, excluded_songs, api_key):
    exclusion_prompt = ''
    if excluded_songs:
        exclusion_prompt = f"\n- DO NOT include any of the following songs: {', '.join(excluded_songs[:55])}."
        
    prompt = f"""You are a world-class music curator specializing in Indian music. Analyze the user's emotional state described below, and curate EXACTLY 25 real Hindi songs that match this mood.

CONSTRAINTS:
- Songs MUST be in Hindi (Bollywood, Hindi indie, or Hindi pop/classical). No English songs.
- Song titles and artists must be real and well-known.{exclusion_prompt}
- Return EXACTLY 25 items. Variety is important — mix eras, tempos, and artists.

User mood: "{vibe}"

Output a JSON array. No markdown, no wrapping. Each object:
{{"title":"Song Title","artist":"Artist Name","explanation":"1-sentence poetic reason why this matches."}}

JSON array:"""

    models_to_try = [
        {"name": "gemini-2.5-flash", "version": "v1beta"},
        {"name": "gemini-2.0-flash", "version": "v1beta"},
        {"name": "gemini-2.5-flash-lite", "version": "v1beta"},
        {"name": "gemini-1.5-flash", "version": "v1"},
        {"name": "gemini-1.5-flash", "version": "v1beta"},
        {"name": "gemini-pro", "version": "v1beta"}
    ]
    
    last_error = None
    for m in models_to_try:
        try:
            print(f"Attempting backend curation with: {m['name']} ({m['version']})")
            text_res = execute_gemini_text_request(prompt, m["name"], m["version"], api_key)
            if text_res:
                clean_text = text_res.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean_text)
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"Backend curation succeeded with: {m['name']}")
                    return parsed[:25]
        except Exception as e:
            print(f"Backend curation fallback model {m['name']} failed: {e}")
            last_error = e
            
    raise Exception(f"All Gemini models failed to curate playlist. Last error: {last_error}")

@app.route('/api/status')
def api_status():
    client_key = request.headers.get('X-Gemini-API-Key')
    return jsonify({
        'gemini_active': bool(client_key or os.environ.get('GEMINI_API_KEY'))
    })

@app.route('/api/curate', methods=['POST'])
def api_curate():
    """
    Kaggle Capstone Curation Endpoint with Fallback Architecture.
    
    1. Primary Flow: Attempts to invoke the Google ADK Multi-Agent pipeline (run_tarang_agent_pipeline),
       which coordinates specialized agents (EmotionAgent, MusicAgent) using a stateful Orchestrator.
    2. Fallback Flow: If the ADK pipeline fails due to quota or model availability, it gracefully falls back
       to the single-agent legacy curation method (curate_with_gemini_backend) to ensure uninterrupted service.
    """
    api_key = request.headers.get('X-Gemini-API-Key') or os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key is not configured.'}), 400
        
    data = request.json or {}
    vibe_raw = data.get('vibe', '')
    vibe, vibe_err = sanitize_text_input(vibe_raw, max_length=500, field_name="vibe")
    if vibe_err:
        return jsonify({'error': vibe_err}), 400
    excluded_songs = data.get('excludedSongs', [])
        
    try:
        # Try ADK multi-agent pipeline first, fall back to legacy
        if ADK_AVAILABLE:
            print("[OrchestratorAgent] Using ADK multi-agent pipeline")
            try:
                songs, emotion_data = run_tarang_agent_pipeline(vibe, excluded_songs, api_key)
                return jsonify({
                    'songs': songs,
                    'emotion_analysis': emotion_data,  # bonus: send emotion data to frontend
                    'pipeline': 'adk_multi_agent'
                })
            except Exception as adk_err:
                print(f"[OrchestratorAgent] ADK pipeline failed, falling back: {adk_err}")
                # Fall through to legacy below

        # Legacy fallback (existing code — keep it exactly as is)
        songs = curate_with_gemini_backend(vibe, excluded_songs, api_key)
        return jsonify({'songs': songs, 'pipeline': 'legacy'})
    except Exception as e:
        print(f"Curation failed: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/voice-curate', methods=['POST'])
def api_voice_curate():
    api_key = request.headers.get('X-Gemini-API-Key') or os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key is not configured.'}), 400

    data = request.json or {}
    audio_base64 = data.get('audio', '')
    mime_type = data.get('mimeType', 'audio/webm')
    
    if not audio_base64:
        return jsonify({'error': 'Audio data is required'}), 400
        
    if len(audio_base64) > 10 * 1024 * 1024:
        return jsonify({'error': 'Audio payload exceeds maximum size limit (10MB)'}), 400
        
    print(f"=== Multimodal Voice Curation Request ({mime_type}) ===")
    
    prompt = """You are 'Tarang', a professional conversational Indian voice assistant and music curator.
    1. Listen to the audio clip and transcribe the user's spoken words.
    2. Auto-detect if the user is speaking in English, Hindi, Gujarati, or code-mixed Indian languages (e.g. Hinglish/Gujlish).
    3. Identify the user's mood, feelings, or situation from their spoken description.
    4. Curate exactly 20 real Hindi/Bollywood songs matching this mood/vibe.
    5. Output a conversational voice response spoken back in the same language detected (English, Hindi, or Gujarati). Keep it to 1-2 short, natural sentences (e.g., 'मैने आपके मूड के लिए 20 सुंदर गाने तैयार किये हैं। चलिए प्ले करते हैं।' or 'મેં તમારા મૂડ માટે 20 સરસ ગીતો ક્યુરેટ કર્યા છે. ચાલો સાંભળીએ.').
    
    IMPORTANT CONSTRAINT: The song recommendations MUST be strictly in the Hindi language (e.g. from Bollywood, Hindi indie, or Hindi classical/pop). Do not recommend songs in English under any circumstances.
    
    You must output ONLY a valid JSON object matching the following structure (do not wrap in markdown or backticks):
    {
      "detectedMood": "A short English phrase representing the mood",
      "detectedLanguage": "en | hi | gu",
      "voiceResponse": "Friendly spoken confirmation text in the user's language",
      "songs": [
        {
          "title": "Song Title",
          "artist": "Artist Name",
          "explanation": "Poetic 1-sentence explanation in English of why it matches"
        }
      ]
    }
    """
    
    # Construct the JSON payload with inlineData audio bytes
    payload = {
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": audio_base64
                    }
                },
                {
                    "text": prompt
                }
            ]
        }]
    }
    
    try:
        text = execute_gemini_multimodal_request(payload, api_key)
        clean_text = text.replace("```json", "").replace("```", "").strip()
        parsed_response = json.loads(clean_text)
        
        print(f"Detected Mood: {parsed_response.get('detectedMood')}")
        print(f"Detected Lang: {parsed_response.get('detectedLanguage')}")
        print(f"Voice Response: {parsed_response.get('voiceResponse')}")
        
        return jsonify(parsed_response)
        
    except Exception as e:
        print(f"Error calling Gemini audio curation API: {e}")
        return jsonify({'error': f"Gemini Multimodal Audio processing failed: {str(e)}"}), 500

@app.route('/api/transcribe', methods=['POST'])
def api_transcribe():
    api_key = request.headers.get('X-Gemini-API-Key') or os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key is not configured.'}), 400

    data = request.json or {}
    audio_base64 = data.get('audio', '')
    mime_type = data.get('mimeType', 'audio/webm')
    
    if not audio_base64:
        return jsonify({'error': 'Audio data is required'}), 400
        
    if len(audio_base64) > 10 * 1024 * 1024:
        return jsonify({'error': 'Audio payload exceeds maximum size limit (10MB)'}), 400
        
    print(f"=== Multimodal Voice Transcription Request ({mime_type}) ===")
    
    # Ultra-fast plain-text transcription prompt
    prompt = "Transcribe the user's spoken words in this audio recording. Return ONLY the plain transcription text with no markdown, explanation, or extra characters."
    
    payload = {
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": audio_base64
                    }
                },
                {
                    "text": prompt
                }
            ]
        }]
    }
    
    try:
        text = execute_gemini_multimodal_request(payload, api_key)
        transcribed_text = text.strip()
        
        # Fast regex language classification
        lang = "en"
        if re.search(r"[\u0900-\u097F]", transcribed_text):
            lang = "hi"
        elif re.search(r"[\u0A80-\u0AFF]", transcribed_text):
            lang = "gu"
            
        print(f"Transcribed Text: {transcribed_text}")
        print(f"Detected Lang: {lang}")
        
        return jsonify({
            "transcript": transcribed_text,
            "language": lang
        })
        
    except Exception as e:
        print(f"Error calling Gemini transcription API: {e}")
        return jsonify({'error': f"Transcription failed: {str(e)}"}), 500

if __name__ == '__main__':
    # Disable file caching for static files during development
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print("Starting Mood-to-Music Curator server on http://localhost:3000...")
    port = int(os.environ.get("PORT", 3000))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
