# Python Backend Server for Mood-to-Music Curator
import os
import urllib.request
import urllib.parse
import re
import json
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
    Scrapes YouTube results page and checks playability of candidates.
    Returns (videoId, candidates_log, status)
    """
    try:
        query_encoded = urllib.parse.quote(query)
        url = f"https://www.youtube.com/results?search_query={query_encoded}"
        
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
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
            
        candidates_log = []
        for vid in video_ids:
            playability = check_playability(vid)
            log_entry = {
                "videoId": vid,
                "status": playability["status"],
                "playableInEmbed": playability["playableInEmbed"],
                "reason": playability["reason"],
                "ok": playability["ok"]
            }
            candidates_log.append(log_entry)
            
            if playability["ok"]:
                return vid, candidates_log, "OK"
                
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

if __name__ == '__main__':
    # Disable file caching for static files during development
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
    print("Starting Mood-to-Music Curator server on http://localhost:3000...")
    app.run(port=3000, debug=True, threaded=True)
