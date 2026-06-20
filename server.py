# Python Backend Server for Mood-to-Music Curator
import os
import urllib.request
import urllib.parse
import re
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.')

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
        return {
            "ok": False,
            "status": "ERROR",
            "playableInEmbed": False,
            "reason": str(e)
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
        return None, candidates_log, "UNPLAYABLE"
        
    except Exception as e:
        print(f"Error in search_and_verify for query '{query}': {e}")
        return None, [], f"ERROR: {str(e)}"

@app.route('/api/search')
def api_search():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
        
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

@app.route('/api/voice-curate', methods=['POST'])
def api_voice_curate():
    data = request.json or {}
    audio_base64 = data.get('audio', '')
    mime_type = data.get('mimeType', 'audio/webm')
    api_key = data.get('apiKey', '')
    
    if not audio_base64:
        return jsonify({'error': 'Audio data is required'}), 400
    if not api_key:
        return jsonify({'error': 'Gemini API key is required'}), 400
        
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
    data = request.json or {}
    audio_base64 = data.get('audio', '')
    mime_type = data.get('mimeType', 'audio/webm')
    api_key = data.get('apiKey', '')
    
    if not audio_base64:
        return jsonify({'error': 'Audio data is required'}), 400
    if not api_key:
        return jsonify({'error': 'Gemini API key is required'}), 400
        
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
    print("Starting Mood-to-Music Curator server on http://localhost:3000...")
    app.run(port=3000, debug=True, threaded=True)
