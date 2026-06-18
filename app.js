// App Controller for Mood-to-Music Curator

// Configuration & State
const state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  curating: false,
  vibeHistory: JSON.parse(localStorage.getItem('vibe_history') || '[]'),
  playlist: [],      // Currently active playlist of 10 songs
  currentIndex: -1,  // Currently playing index in playlist
  autoplayEnabled: true, // Auto play enabled by default
  source: 'gemini'   // Curation source
};

let ytPlayer = null; // YouTube Player object

// Load the YouTube Iframe Player API script dynamically
(function() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
})();

// Fallback music database for offline / no-API key operation (strictly Hindi songs - 10 per category)
const fallbackDatabase = {
  cozy: [
    { title: "Kabira", artist: "Tochi Raina & Rekha Bhardwaj", explanation: "The mellow acoustic guitar and earthy Sufi vocals wrap you in a warm, contemplative blanket of absolute comfort." },
    { title: "Iktara", artist: "Amit Trivedi & Kavita Seth", explanation: "A gentle blend of acoustic plucking and soulful vocals that capture the quiet warmth of a rainy Sunday afternoon." },
    { title: "Khoj", artist: "The Local Train", explanation: "Warm Hindi indie rock chords that build a cozy, introspective space for quiet reflection." },
    { title: "Kun Faya Kun", artist: "A.R. Rahman, Javed Ali & Mohit Chauhan", explanation: "A soaring, spiritual Sufi masterpiece that brings immediate warmth and inner peace to your surroundings." },
    { title: "Sham", artist: "Amit Trivedi", explanation: "A breezy acoustic song that feels like a quiet evening sitting with hot tea as the sky turns gold." },
    { title: "Tu Bin Bataye", artist: "Madhushree & Naresh Iyer", explanation: "Soft acoustics and peaceful vocals that paint a warm picture of quiet intimacy and comfort." },
    { title: "Der Se Hi", artist: "Shekhar Ravjiani", explanation: "A relaxing acoustic ballad that feels like waking up late under a heavy blanket on a winter morning." },
    { title: "Kaise Mujhe", artist: "Benny Dayal & Shreya Ghoshal", explanation: "A beautiful, emotional acoustic melody that captures the soft comfort of pure love." },
    { title: "Choo Lo", artist: "The Local Train", explanation: "Warm, gentle rock strums combined with passionate Hindi lyrics that hug your soul." },
    { title: "O Meri Laila", artist: "Atif Aslam", explanation: "A dreamy, romantic folk-infused melody that wraps you in a cozy blanket of nostalgia." },
    { title: "Samjhawan", artist: "Arijit Singh & Shreya Ghoshal", explanation: "A gentle romantic ballad that brings warmth and sweet comfort to your heart." },
    { title: "Moh Moh Ke Dhaage", artist: "Papon", explanation: "Warm, classical-infused notes and deep soulful vocals that feel incredibly cozy." },
    { title: "Saibo", artist: "Shreya Ghoshal & Tochi Raina", explanation: "A sweet, breezy acoustic melody that wraps you in quiet comfort." }
  ],
  happy: [
    { title: "Ilahi", artist: "Arijit Singh", explanation: "A joyous acoustic rhythm and free-spirited vocals celebrating the simple beauty of new journeys and bright mornings." },
    { title: "Khaabon Ke Parindey", artist: "Alyssa Mendonsa", explanation: "A dreamy, light acoustic melody that sounds like pure sunshine filtering through a car window on a peaceful highway." },
    { title: "Senorita", artist: "Farhan Akhtar, Hrithik Roshan & Abhay Deol", explanation: "A playful, upbeat flamenco guitar groove that instantly lifts your spirits and invites you to dance along." },
    { title: "Matargashti", artist: "Mohit Chauhan", explanation: "A quirky, high-energy track with theatrical vocals that radiate playfulness and uninhibited joy." },
    { title: "Zindagi Na Milegi Dobara", artist: "Shankar Mahadevan", explanation: "An upbeat, breezy synth-pop melody that captures the pure joy of living life in the present." },
    { title: "Yun Hi Chala Chal", artist: "Udit Narayan, Hariharan & Kailash Kher", explanation: "An absolute feel-good classic with an upbeat rhythm that makes you want to sing out loud on the road." },
    { title: "Subhanallah", artist: "Sreerama Chandra", explanation: "A sweet, cheerful acoustic song that fills your heart with warmth and romantic joy." },
    { title: "Urr Chal", artist: "Yasser Desai", explanation: "A soaring, happy pop melody that captures the weightless feeling of freedom and joy." },
    { title: "Dil Dhadakne Do", artist: "Shankar Mahadevan & Suraj Jagan", explanation: "A driving, upbeat indie-pop anthem celebrating the pure happiness of living life on your terms." },
    { title: "Mast Magan", artist: "Arijit Singh", explanation: "A sweet, bouncy folk-pop groove filled with simple joy and heartfelt warmth." },
    { title: "Badtameez Dil", artist: "Benny Dayal", explanation: "An absolute burst of high-energy, fun, and celebratory dance beats." },
    { title: "Gallan Goodiyaan", artist: "Yashita Sharma & Farhan Akhtar", explanation: "A high-octane family dance anthem that instantly puts a smile on your face." },
    { title: "Kar Gayi Chull", artist: "Badshah & Neha Kakkar", explanation: "An energetic, upbeat party starter to lift your mood instantly." }
  ],
  sad: [
    { title: "Channa Mereya", artist: "Arijit Singh", explanation: "A passionate, emotional tour de force capturing the raw, heavy heartache of celebrating a love that must be let go." },
    { title: "Luka Chuppi", artist: "Lata Mangeshkar & A.R. Rahman", explanation: "A deeply moving, delicate acoustic ballad that makes the heart ache with sweet, nostalgic grief." },
    { title: "Agar Tum Saath Ho", artist: "Arijit Singh & Alka Yagnik", explanation: "An intense, emotionally turbulent duet that perfectly validates the heavy, dark rainstorms of the soul." },
    { title: "Tu Jaane Na", artist: "Atif Aslam", explanation: "A sweeping, heartbreaking pop ballad detailing the silent, aching distance between two hearts." },
    { title: "Gehraiyaan (Title Track)", artist: "Lothika", explanation: "A hauntingly beautiful, ambient ballad that echoes with the deep, dark waves of longing and sorrow." },
    { title: "Judaai", artist: "Rekha Bhardwaj & Arijit Singh", explanation: "A heavy, sorrowful track with raw Punjabi/Hindi lyrics that validate the pain of separation." },
    { title: "Bekhayali", artist: "Sachet Tandon", explanation: "A powerful, agonizing rock-infused ballad expressing the intense, dark storms of heartbreak." },
    { title: "Tujhe Kitna Chahne Lage", artist: "Arijit Singh", explanation: "A melancholic acoustic song about silent longing and the ache of missing someone deeply." },
    { title: "Hamari Adhuri Kahani", artist: "Arijit Singh", explanation: "A sweeping, tragic orchestral ballad reflecting the heavy grief of unfulfilled love." },
    { title: "Tune Jo Na Kaha", artist: "Mohit Chauhan", explanation: "A soft, heartbreaking melody detailing the silent, painful space of unexpressed feelings." },
    { title: "Kabira (Encore)", artist: "Arijit Singh & Harshdeep Kaur", explanation: "A deeply emotional farewell track that hits the absolute depth of separation pain." },
    { title: "Tujhe Bhula Diya", artist: "Mohit Chauhan & Shekhar Ravjiani", explanation: "An intense, tragic ballad capturing the silent, painful battle of letting go." },
    { title: "Jaan Nisaar", artist: "Arijit Singh", explanation: "A slow-burning, intensely painful melody of unexpressed heartbreak." }
  ],
  chill: [
    { title: "Tune Kaha", artist: "Prateek Kuhad", explanation: "Minimalist acoustic guitar and sweet, whispered vocals that set a calm, dreamy, and relaxing afternoon atmosphere." },
    { title: "Choona", artist: "When Chai Met Toast", explanation: "Warm acoustic indie-folk vibes combined with mellow Hindi lyrics that put your mind completely at ease." },
    { title: "Tum Se Hi", artist: "Mohit Chauhan", explanation: "A soft, breezy rock beat combined with soothing vocals that feels like a refreshing cool wind after a long, tiring day." },
    { title: "Baarishein", artist: "Anuv Jain", explanation: "A tender, raw acoustic-ukulele track that paints a tranquil picture of slow raindrops and quiet moments." },
    { title: "Dil Mere", artist: "The Local Train", explanation: "A mellow, atmospheric indie ballad with smooth vocals and a relaxing, drifting guitar bridge." },
    { title: "Alag Aasmaan", artist: "Anuv Jain", explanation: "A gentle ukulele and soft vocal piece that creates a tranquil, floating space." },
    { title: "Kasoor (Acoustic)", artist: "Prateek Kuhad", explanation: "Minimalist acoustic guitar with breezy, soothing vocals for late night relaxing." },
    { title: "Hosanna", artist: "Leon D'Souza & Vijay Prakash", explanation: "Ethereal choral synths and smooth vocals that put your mind into a peaceful trance." },
    { title: "Zara Zara", artist: "Bombay Jayashri", explanation: "A classic, sensual, and slow-burning melody that sets a deeply calm and warm evening mood." },
    { title: "Jee Karda (Slow Version)", artist: "Divya Kumar", explanation: "A slow-rolling, atmospheric arrangement that creates a deep, velvet, laid-back vibe." },
    { title: "Dil Ko Karaar Aaya", artist: "Yasser Desai & Neha Kakkar", explanation: "A gentle, slow-tempo track that immediately calms your mind." },
    { title: "Ranjha", artist: "B Praak & Jasleen Royal", explanation: "A dreamy, soft, and soothing acoustic ballad that floats in the air." },
    { title: "Qaafirana", artist: "Arijit Singh & Nikhita Gandhi", explanation: "A breezy, scenic acoustic journey that clears your mind and relaxes your thoughts." }
  ],
  hype: [
    { title: "Ziddi Dil", artist: "Vishal Dadlani", explanation: "A high-octane rock anthem with heavy drums and powerhouse vocals to pump up your adrenaline and drive." },
    { title: "Bhaag Milkha Bhaag", artist: "Siddharth Mahadevan", explanation: "A thunderous, motivating rock track filled with soaring electric guitars and pure motivational fire." },
    { title: "Apna Time Aayega", artist: "Ranveer Singh & Dub Sharma", explanation: "A raw, high-energy Hindi rap beat combined with self-assertive lyrics that ignite intense focus and confidence." },
    { title: "Kar Har Maidaan Fateh", artist: "Sukhwinder Singh", explanation: "A driving, triumphant orchestral rock blend that urges you to rise up and conquer any challenge." },
    { title: "Brothers Anthem", artist: "Vishal Dadlani", explanation: "An epic, heavy cinematic rock track designed to give you a massive boost of energy and strength." },
    { title: "Sultan (Title Track)", artist: "Sukhwinder Singh", explanation: "Epic backing chants and thunderous dhol beats that make you feel like an absolute warrior." },
    { title: "Dangal (Title Track)", artist: "Daler Mehndi", explanation: "High-power vocals combined with marching beats for pure focus and maximum physical energy." },
    { title: "Sher Aaya Sher", artist: "Divine", explanation: "Aggressive street hip-hop and heavy bass that immediately bring raw power and beast-mode energy." },
    { title: "Jai Ho", artist: "A.R. Rahman", explanation: "An internationally acclaimed, high-energy celebratory anthem with driving percussion and triumph." },
    { title: "Challa", artist: "Rabbi Shergill", explanation: "Upbeat Punjabi-Hindi rock strums and driving drum lines that ignite immediate motivation." },
    { title: "Malhari", artist: "Vishal Dadlani", explanation: "A thunderous, explosive war victory dance with massive dhol beats." },
    { title: "Zinda", artist: "Siddharth Mahadevan", explanation: "A soaring motivational rock track that inspires you to live your dreams with fire." },
    { title: "Challa (Lari Lappa)", artist: "Rabbi Shergill", explanation: "A driving, rhythmic folk-rock song that keeps you running with focus and pace." }
  ],
  focus: [
    { title: "Yeh Honsla", artist: "Salim Merchant & Shreya Ghoshal", explanation: "A calm, moving acoustic ballad that anchors the mind and builds a quiet, resilient focus." },
    { title: "Yun Hi Chala Chal", artist: "Udit Narayan, Hariharan & Kailash Kher", explanation: "A steady, rolling road-trip groove that keeps your mind engaged and flowing at a productive, even pace." },
    { title: "Roobaroo", artist: "A.R. Rahman & Naresh Iyer", explanation: "A bright, acoustic guitar-driven flow that sharpens focus and brings a sunny clarity to your workspace." },
    { title: "Phir Se Ud Chala", artist: "Mohit Chauhan", explanation: "An atmospheric, shifting soundscape that lets your thoughts drift, organize, and focus on creative work." },
    { title: "O Rey Chhori (Instrumental)", artist: "A.R. Rahman", explanation: "Beautiful classical Indian flute and string movements that clear distractions and focus the brain." },
    { title: "Kaise Mujhe (Instrumental)", artist: "A.R. Rahman", explanation: "Beautiful piano and string harmonies that clear distractions and focus your mind." },
    { title: "Tum Se Hi (Instrumental)", artist: "Pritam", explanation: "A soothing acoustic guitar flow that helps you enter a deep work or study zone." },
    { title: "Kar Har Maidaan Fateh (Slow Instrumental)", artist: "Shankar-Ehsaan-Loy", explanation: "Soft orchestral swells that build a quiet, determined momentum for study and coding." },
    { title: "Kun Faya Kun (Instrumental Flute)", artist: "A.R. Rahman", explanation: "Tranquil flute and table notes that block out mental noise and ease focus." },
    { title: "Lakshya (Title Track)", artist: "Shankar Mahadevan", explanation: "A steady, inspirational build that acts as a mental guide to channel your energy into work." },
    { title: "Maula Mere Maula", artist: "Roop Kumar Rathod", explanation: "A peaceful, deep ambient classical melody that helps you enter a quiet state of focus." },
    { title: "Manja", artist: "Amit Trivedi", explanation: "A hopeful, acoustic build-up that helps channel positive focus into your work." },
    { title: "Zinda (Instrumental)", artist: "Shankar-Ehsaan-Loy", explanation: "An energetic yet steady instrumental build that keeps your brain in high-productivity zone." }
  ]
};

// Generate CSS Gradient styles for Music Cover Arts based on artist/title to make cards pop beautifully
function getDynamicGradient(title, artist) {
  const hash = [...(title + artist)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const angles = [135, 45, 225, 315];
  const angle = angles[hash % angles.length];
  
  const colorPalettes = [
    ["#a855f7", "#3b82f6"], // Purple to Blue
    ["#ec4899", "#f43f5e"], // Pink to Rose
    ["#f59e0b", "#eab308"], // Amber to Yellow
    ["#10b981", "#06b6d4"], // Emerald to Cyan
    ["#6366f1", "#d946ef"], // Indigo to Fuchsia
    ["#f97316", "#ef4444"], // Orange to Red
    ["#475569", "#1e293b"]  // Slate to Slate
  ];
  
  const palette = colorPalettes[hash % colorPalettes.length];
  return `linear-gradient(${angle}deg, ${palette[0]} 0%, ${palette[1]} 100%)`;
}

// Fallback Curator Logic (Keyword Matching)
function curateFallback(vibe) {
  const lowerVibe = vibe.toLowerCase();
  let category = 'chill'; // default category
  
  const rules = [
    { keys: ["rain", "storm", "cloud", "coffee", "cozy", "autumn", "winter", "sleep", "night", "quiet", "soft", "morning"], cat: "cozy" },
    { keys: ["happy", "joy", "sun", "bright", "good", "summer", "dance", "celebrate", "smile", "fun", "party", "pop"], cat: "happy" },
    { keys: ["sad", "blue", "cry", "broke", "lonely", "dark", "heavy", "grief", "pain", "miss", "lost"], cat: "sad" },
    { keys: ["hype", "energetic", "workout", "run", "fast", "power", "gym", "motivation", "beast", "sport", "drive"], cat: "hype" },
    { keys: ["focus", "study", "code", "work", "read", "instrumental", "calm", "peace", "chill", "relax", "slow"], cat: "focus" }
  ];

  for (const rule of rules) {
    if (rule.keys.some(k => lowerVibe.includes(k))) {
      category = rule.cat;
      break;
    }
  }

  // Pick fallback songs from selected category
  const list = fallbackDatabase[category];
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  return shuffled;
}

// REST call to a single model
async function makeGeminiRequest(model, version, vibe, apiKey) {
  // Requesting exactly 20 songs to filter out any potentially restricted video links
  const prompt = `You are a world-class music curator specializing in Indian music. Analyze the user's emotional state and situational context described below, and curate EXACTLY 20 real songs that capture this mood.
  
  IMPORTANT CONSTRAINT: The songs curated MUST be strictly in the Hindi language (e.g. from Bollywood, Hindi indie, or Hindi classical/pop). Do not recommend songs in English or any other language under any circumstances. Ensure the song titles and artists are real and correspond to Hindi songs.

User vibe description: "${vibe}"

Your output must be a valid JSON array of objects. Do NOT include markdown styling or outer tags. Ensure exactly 20 items are returned.
Each object must have the following schema:
{
  "title": "Song Title (in Hindi/English transliteration, e.g. 'Kabira' or 'Tum Se Hi')",
  "artist": "Artist Name (e.g. 'Arijit Singh')",
  "explanation": "A short, poetic, and atmospheric explanation in English of exactly why this song matches their vibe, limited to 1-2 sentences."
}

JSON output:`;

  const response = await fetch(`https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error("Empty response from AI engine.");
  }

  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanText);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.slice(0, 20);
  }
  throw new Error("AI returned data in an unexpected format.");
}

// Call Gemini API client-side with a model retry loop to solve model deprecations/permissions
async function curateWithGemini(vibe, apiKey) {
  const modelsToTry = [
    { name: 'gemini-2.5-flash', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-1.5-pro', version: 'v1' },
    { name: 'gemini-1.5-pro', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1beta' }
  ];
  let lastError = null;

  for (const item of modelsToTry) {
    try {
      console.log(`Attempting curation with model: ${item.name} (${item.version})`);
      const songs = await makeGeminiRequest(item.name, item.version, vibe, apiKey);
      console.log(`Curation successful with model: ${item.name} (${item.version})`);
      return songs;
    } catch (err) {
      console.warn(`Model ${item.name} (${item.version}) request failed:`, err);
      lastError = err;
      if (err.message && (err.message.includes("API key not valid") || err.message.includes("API_KEY_INVALID"))) {
        throw err;
      }
    }
  }
  throw new Error(`All Gemini models failed. Last error details: ${lastError?.message || lastError}`);
}

// Verification Log Terminal Writer Helper
function writeConsoleLog(message, type = 'info') {
  const consoleLogs = document.getElementById('console-logs');
  if (!consoleLogs) return;
  
  const div = document.createElement('div');
  let colorClass = 'text-purple-300';
  let prefix = '&gt; ';
  
  if (type === 'pass') {
    colorClass = 'text-emerald-400 font-bold';
    prefix = '[PASS] ';
  } else if (type === 'fail') {
    colorClass = 'text-rose-400 font-semibold';
    prefix = '[FAIL] ';
  } else if (type === 'warn') {
    colorClass = 'text-amber-400';
    prefix = '[WARN] ';
  } else if (type === 'header') {
    colorClass = 'text-white font-bold tracking-wide border-b border-white/5 pb-1 mt-3 mb-1 block';
    prefix = '=== ';
  }
  
  div.className = colorClass;
  div.innerHTML = `${prefix}${message}`;
  consoleLogs.appendChild(div);
  
  // Auto-scroll to the bottom
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

// UI Rendering Functions
function renderSkeleton() {
  const resultsContainer = document.getElementById('results-container');
  const playerPanel = document.getElementById('music-player-panel');
  
  playerPanel.classList.add('hidden');
  resultsContainer.innerHTML = '';
  resultsContainer.classList.remove('hidden');

  for (let i = 0; i < 10; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'glass-card fluid-rounded fluid-p flex flex-col items-center text-center select-none h-full';
    skeleton.innerHTML = `
      <div class="w-[clamp(100px,30vw,136px)] h-[clamp(100px,30vw,136px)] rounded-2xl shimmer-bg mb-4"></div>
      <div class="h-6 w-3/4 shimmer-bg rounded-md mb-2"></div>
      <div class="h-4 w-1/2 shimmer-bg rounded-md mb-6"></div>
      <div class="h-3 w-full shimmer-bg rounded-md mb-2"></div>
      <div class="h-3 w-5/6 shimmer-bg rounded-md mb-4"></div>
      <div class="h-10 w-full shimmer-bg rounded-xl mt-auto"></div>
    `;
    resultsContainer.appendChild(skeleton);
  }
}

// Play a specific song in the playlist directly in the page player using YT Player API
async function playSongAtIndex(index) {
  if (index < 0 || index >= state.playlist.length) return;
  
  state.currentIndex = index;
  const song = state.playlist[index];
  
  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const playerArt = document.getElementById('player-art');
  const playerStatus = document.getElementById('player-status');
  const playerIndex = document.getElementById('player-index');
  
  playerTitle.textContent = song.title;
  playerArtist.textContent = song.artist;
  playerArt.style.background = getDynamicGradient(song.title, song.artist);
  playerIndex.textContent = `Song ${index + 1} of ${state.playlist.length}`;
  
  // Highlight active card
  const resultsContainer = document.getElementById('results-container');
  if (resultsContainer) {
    const cards = resultsContainer.children;
    Array.from(cards).forEach((card, idx) => {
      if (idx === index) {
        card.classList.add('border-red-500/50', 'bg-purple-950/20');
        card.classList.remove('border-white/5');
      } else {
        card.classList.remove('border-red-500/50', 'bg-purple-950/20');
        card.classList.add('border-white/5');
      }
    });
  }

  if (song.videoId) {
    playerStatus.innerHTML = `<span class="text-emerald-400 animate-pulse">Initializing stream...</span>`;
    
    // Programmatically initialize or load the YouTube Video
    loadYoutubeVideo(song.videoId);
    
    // Smooth scroll to player panel
    document.getElementById('music-player-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    playerStatus.innerHTML = `<span class="text-red-400">Video stream unavailable</span>`;
  }
}

// Dynamically handle loading the YouTube Player
function loadYoutubeVideo(videoId) {
  if (typeof YT === 'undefined' || !YT.Player) {
    // Retry in 100ms if YT library is not yet loaded
    setTimeout(() => loadYoutubeVideo(videoId), 100);
    return;
  }
  
  try {
    if (!ytPlayer) {
      ytPlayer = new YT.Player('youtube-player-iframe-placeholder', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          'autoplay': 1,
          'enablejsapi': 1,
          'origin': window.location.origin,
          'rel': 0,
          'modestbranding': 1
        },
        events: {
          'onReady': (event) => {
            event.target.playVideo();
            document.getElementById('player-status').innerHTML = `<span class="text-emerald-400 animate-pulse">Playing on-page</span>`;
          },
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });
    } else {
      ytPlayer.loadVideoById(videoId);
      document.getElementById('player-status').innerHTML = `<span class="text-emerald-400 animate-pulse">Playing on-page</span>`;
    }
  } catch (err) {
    console.error("Error setting up YouTube Player instance:", err);
    writeConsoleLog(`YouTube Player Error: ${err.message}`, 'fail');
  }
}

// Handle player status changes (Autoplay Next)
function onPlayerStateChange(event) {
  // event.data === YT.PlayerState.ENDED (0)
  if (event.data === 0) {
    if (state.autoplayEnabled) {
      writeConsoleLog(`Playback completed. Autoplay is enabled. Picking another random song...`, 'info');
      playRandomSong();
    } else {
      writeConsoleLog(`Playback completed. Autoplay is disabled. Stopped.`, 'info');
      document.getElementById('player-status').textContent = "Playback completed";
    }
  }
}

// Dynamic recovery handler for blocked/unplayable streams
function onPlayerError(event) {
  const errorCode = event.data;
  console.warn(`YouTube video failed with error code: ${errorCode}`);
  
  let errorMsg = "Unknown playback error";
  if (errorCode === 2) errorMsg = "Invalid video ID parameter";
  if (errorCode === 5) errorMsg = "HTML5 player playback error";
  if (errorCode === 100) errorMsg = "Video removed, private, or not found";
  if (errorCode === 101 || errorCode === 150) errorMsg = "Embedding restricted by uploader (blocked domain/region)";
  
  writeConsoleLog(`Playback failed (Error Code ${errorCode}): ${errorMsg}`, 'fail');
  
  if (state.currentIndex >= 0 && state.currentIndex < state.playlist.length) {
    const failedSong = state.playlist[state.currentIndex];
    writeConsoleLog(`Self-Healing Recovery: Splicing out restricted track "${failedSong.title}" from active list.`, 'warn');
    
    // Squeeze out the failed song from playlist array
    state.playlist.splice(state.currentIndex, 1);
    
    // Re-render the cards grid (this removes the broken card automatically)
    renderSongs(state.playlist, state.source);
    
    showToast(`"${failedSong.title}" is unavailable. Automatically filtered out.`, true);
    
    // Switch to another song index
    if (state.playlist.length > 0) {
      let nextIndex = state.currentIndex;
      if (nextIndex >= state.playlist.length) {
        nextIndex = 0; // wrap around
      }
      playSongAtIndex(nextIndex);
    } else {
      showToast("All songs in the active curation are unplayable.", true);
      document.getElementById('player-status').innerHTML = `<span class="text-red-400">All streams unplayable</span>`;
    }
  }
}

// Play a random song from the curated playlist
function playRandomSong() {
  if (state.playlist.length === 0) return;
  
  let randomIndex = Math.floor(Math.random() * state.playlist.length);
  if (state.playlist.length > 1 && randomIndex === state.currentIndex) {
    randomIndex = (randomIndex + 1) % state.playlist.length;
  }
  
  playSongAtIndex(randomIndex);
}

// Play next song in sequence
function playNext() {
  if (state.playlist.length === 0) return;
  const nextIndex = (state.currentIndex + 1) % state.playlist.length;
  playSongAtIndex(nextIndex);
}

function renderSongs(songs, source) {
  state.playlist = songs;
  state.currentIndex = -1;
  state.source = source;
  
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.innerHTML = '';
  
  const alertContainer = document.getElementById('api-alert');
  if (source === 'mock') {
    alertContainer.classList.remove('hidden');
    alertContainer.innerHTML = `
      <div class="flex items-center gap-3 bg-purple-950/40 border border-purple-500/20 px-4 py-3 rounded-xl max-w-2xl mx-auto mb-6 text-sm text-purple-300">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Running in <strong>Demo Mode</strong>. We curated these songs locally. To unlock real-time Gemini AI mood sensing, add your Gemini API Key using the gear icon above.</span>
      </div>
    `;
  } else {
    alertContainer.classList.add('hidden');
  }

  // Reveal the Ambient Music Player panel
  const playerPanel = document.getElementById('music-player-panel');
  playerPanel.classList.remove('hidden');
  
  // Set default details in player
  document.getElementById('player-title').textContent = "Playlist Loaded";
  document.getElementById('player-artist').textContent = `${songs.length} Hindi Songs Curated & Verified`;
  document.getElementById('player-status').textContent = "Click Play Curation or select a card below";
  document.getElementById('player-index').textContent = `0 of ${songs.length} songs`;
  
  // Stop existing video if any
  if (ytPlayer && ytPlayer.stopVideo) {
    try {
      ytPlayer.stopVideo();
    } catch(e) {}
  }
  
  // Render final working cards
  songs.forEach((song, idx) => {
    const card = document.createElement('div');
    card.className = `glass-card fluid-rounded fluid-p flex flex-col items-center text-center animate-fade-in-up opacity-0 relative select-none h-full`;
    card.style.animationDelay = `${idx * 0.08}s`;
    
    const gradient = getDynamicGradient(song.title, song.artist);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist + ' song')}`;

    card.innerHTML = `
      <div class="relative w-[clamp(100px,30vw,136px)] h-[clamp(100px,30vw,136px)] rounded-2xl mb-4 shadow-lg flex items-center justify-center group overflow-hidden" style="background: ${gradient}">
        <!-- Floating play overlay on hover -->
        <div onclick="playSongAtIndex(${idx})" class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white transform scale-90 group-hover:scale-100 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <!-- Note Icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white/90 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
      
      <!-- Verified Playability Badge -->
      <div class="flex items-center gap-1 mb-2.5 text-emerald-400 text-[var(--font-small)] font-semibold uppercase tracking-wider select-none bg-emerald-950/35 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Verified Playable</span>
      </div>
      
      <h3 class="font-display font-bold text-[var(--font-card-title)] text-white line-clamp-1 mb-1 cursor-pointer hover:text-red-400 transition-colors" title="${song.title}" onclick="playSongAtIndex(${idx})">${song.title}</h3>
      <p class="text-purple-300 font-medium text-[var(--font-small)] mb-3 line-clamp-1">${song.artist}</p>
      
      <p class="text-gray-300 text-[var(--font-small)] leading-relaxed mb-5 italic">"${song.explanation}"</p>
      
      <div class="mt-auto flex flex-col gap-2 w-full">
        <button onclick="playSongAtIndex(${idx})" class="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold py-2 md:py-2.5 rounded-xl text-[var(--font-small)] uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer">
          <svg class="h-4 w-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Play Here
        </button>
        <a href="${youtubeUrl}" target="_blank" class="w-full inline-flex items-center justify-center gap-1.5 glass hover:bg-white/5 text-gray-300 hover:text-white py-2 md:py-2.5 rounded-xl text-[var(--font-small)] uppercase tracking-wider transition-all cursor-pointer">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.163c-.272-1.022-1.074-1.826-2.099-2.099C19.558 3.5 12 3.5 12 3.5s-7.558 0-9.399.564C.776 4.337-.026 5.141-.298 6.163.224 8.007.224 12 .224 12s0 3.993.522 5.837c.272 1.022 1.074 1.826 2.099 2.099C4.442 20.5 12 20.5 12 20.5s7.558 0 9.399-.564c1.025-.273 1.827-1.077 2.099-2.099.522-1.844.522-5.837.522-5.837s0-3.993-.522-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          Open YouTube
        </a>
      </div>
    `;
    resultsContainer.appendChild(card);
  });
}

function renderError(message) {
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.innerHTML = `
    <div class="col-span-full glass-card border-red-500/20 p-8 rounded-2xl text-center max-w-xl mx-auto">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 class="font-display font-bold text-lg text-white mb-2">Curation Failed</h3>
      <p class="text-red-200 text-sm mb-4">${message}</p>
      <button onclick="document.getElementById('curate-btn').click()" class="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
        Try Again
      </button>
    </div>
  `;
}

// History Panel Logic
function saveVibeToHistory(vibe) {
  if (!vibe.trim()) return;
  if (state.vibeHistory[0] === vibe) return;
  
  state.vibeHistory.unshift(vibe);
  state.vibeHistory = state.vibeHistory.slice(0, 5);
  localStorage.setItem('vibe_history', JSON.stringify(state.vibeHistory));
  renderHistoryChips();
}

function renderHistoryChips() {
  const container = document.getElementById('history-container');
  const wrapper = document.getElementById('history-wrapper');
  
  if (state.vibeHistory.length === 0) {
    wrapper.classList.add('hidden');
    return;
  }
  
  wrapper.classList.remove('hidden');
  container.innerHTML = '';
  
  state.vibeHistory.forEach(vibe => {
    const chip = document.createElement('button');
    chip.className = 'glass px-4 py-1.5 rounded-full text-xs text-gray-300 hover:text-white hover:border-purple-500/40 transition-all text-left line-clamp-1 max-w-[200px]';
    chip.textContent = vibe;
    chip.title = vibe;
    chip.addEventListener('click', () => {
      document.getElementById('mood-input').value = vibe;
      handleCuration(vibe);
    });
    container.appendChild(chip);
  });
}

// Main Curate Handler
async function handleCuration(vibe) {
  if (state.curating || !vibe.trim()) return;

  state.curating = true;
  const button = document.getElementById('curate-btn');
  const buttonText = document.getElementById('btn-text');
  const buttonIcon = document.getElementById('btn-icon');
  
  button.disabled = true;
  button.classList.add('opacity-85', 'cursor-not-allowed');
  buttonText.textContent = 'Curating vibe...';
  buttonIcon.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;

  renderSkeleton();
  saveVibeToHistory(vibe);

  // Clear and open the testing console
  const consolePanel = document.getElementById('verification-console-panel');
  const consoleLogs = document.getElementById('console-logs');
  if (consolePanel) consolePanel.classList.remove('hidden');
  if (consoleLogs) consoleLogs.innerHTML = '';

  writeConsoleLog(`Initializing curation verification for vibe: "${vibe}"`, 'info');

  try {
    let songs;
    let source = 'gemini';
    
    if (state.apiKey && state.apiKey.trim()) {
      try {
        writeConsoleLog("Connecting to Gemini AI model pool...", "info");
        songs = await curateWithGemini(vibe, state.apiKey);
        writeConsoleLog(`Received ${songs.length} song recommendations from Gemini.`, "pass");
      } catch (err) {
        console.warn("Gemini curation failed, falling back to local database:", err);
        showToast(`Gemini API Error: ${err.message || err}. Using offline demo fallback.`, true);
        writeConsoleLog(`Gemini API call failed (${err.message || err}). Falling back to local database.`, "warn");
        songs = curateFallback(vibe);
        source = 'mock';
      }
    } else {
      writeConsoleLog("No API Key configured. Accessing local database...", "warn");
      await new Promise(resolve => setTimeout(resolve, 800));
      songs = curateFallback(vibe);
      source = 'mock';
      writeConsoleLog(`Loaded ${songs.length} candidate songs from local fallback database.`, "pass");
    }

    // Update loader text to show stream verification status
    buttonText.textContent = 'Verifying streams...';
    writeConsoleLog("Starting playability checks on all tracks in parallel...", "header");
    
    // Resolve and verify YouTube video IDs for all curated songs in parallel
    const resolvePromises = songs.map(async (song, idx) => {
      const trackIdStr = `#${idx + 1} "${song.title}"`;
      try {
        const query = `${song.title} ${song.artist} song`;
        writeConsoleLog(`Querying: ${trackIdStr} by ${song.artist}`, "info");
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          
          // Print candidate test records in log
          if (data.candidates && data.candidates.length > 0) {
            data.candidates.forEach((cand, cIdx) => {
              const statusText = cand.ok 
                ? "PLAYABLE (Status: OK, Embed Allowed)" 
                : `UNPLAYABLE (Status: ${cand.status}${cand.reason ? ', Reason: ' + cand.reason : ''})`;
              const indicator = cand.ok ? "pass" : "fail";
              writeConsoleLog(`  [Cand ${cIdx + 1}] ID ${cand.videoId} -> ${statusText}`, indicator);
            });
          }
          
          if (data.videoId) {
            song.videoId = data.videoId;
            writeConsoleLog(`PASSED: ${trackIdStr} matched to working video: youtube-nocookie.com/embed/${data.videoId}`, "pass");
          } else {
            song.videoId = null;
            writeConsoleLog(`REJECTED: ${trackIdStr} could not resolve any embeddable video streams.`, "fail");
          }
        } else {
          song.videoId = null;
          writeConsoleLog(`FAILED: Search API error for ${trackIdStr}.`, "fail");
        }
      } catch (err) {
        song.videoId = null;
        writeConsoleLog(`ERROR: Network check failed for ${trackIdStr}: ${err.message}`, "fail");
        console.warn(`Could not pre-resolve video stream for ${song.title}:`, err);
      }
    });
    
    await Promise.all(resolvePromises);
    
    // Filter out songs with no verified embeddable video streams
    const workingSongs = songs.filter(s => s.videoId);
    const finalSongs = workingSongs.slice(0, 10);
    
    writeConsoleLog("Playability Validation Complete", "header");
    writeConsoleLog(`Results: Checked ${songs.length} candidate songs -> ${workingSongs.length} verified playable -> ${songs.length - workingSongs.length} filtered out.`, "info");
    
    if (finalSongs.length === 0) {
      writeConsoleLog("CRITICAL: Zero playable streams found. Suggestions list is empty.", "fail");
      throw new Error("Could not resolve any verified working video streams for the curation. Please try another vibe.");
    }
    
    writeConsoleLog(`Presenting top ${finalSongs.length} verified working tracks to the user.`, "pass");
    renderSongs(finalSongs, source);
    
    // Auto Play random song immediately upon successful loading
    writeConsoleLog("Curation complete. Auto Play enabled: launching a random track.", "info");
    playRandomSong();
  } catch (error) {
    console.error("Curation handler error:", error);
    renderError(error.message);
  } finally {
    state.curating = false;
    button.disabled = false;
    button.classList.remove('opacity-85', 'cursor-not-allowed');
    buttonText.textContent = 'Curate My Mood';
    buttonIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    `;
  }
}

// Settings Modal Management
function setupSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const openBtn = document.getElementById('open-settings-btn');
  const closeBtn = document.getElementById('close-settings-btn');
  const saveBtn = document.getElementById('save-settings-btn');
  const keyInput = document.getElementById('api-key-input');
  
  keyInput.value = state.apiKey;
  updateKeyBadge(state.apiKey);
  debugListModels(state.apiKey);

  const openModal = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    keyInput.value = state.apiKey;
  };

  const closeModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  saveBtn.addEventListener('click', () => {
    const rawKey = keyInput.value.trim();
    state.apiKey = rawKey;
    localStorage.setItem('gemini_api_key', rawKey);
    updateKeyBadge(rawKey);
    closeModal();
    debugListModels(rawKey);
    showToast("Settings saved successfully!");
  });
}

function updateKeyBadge(key) {
  const badge = document.getElementById('api-status-badge');
  if (key) {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[var(--font-small)] font-medium bg-emerald-950/50 border border-emerald-500/30 text-emerald-400";
    badge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      Gemini API Active
    `;
  } else {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[var(--font-small)] font-medium bg-purple-950/50 border border-purple-500/30 text-purple-300";
    badge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
      Demo Mode
    `;
  }
}

// Elegant Simple Toast Notification
function showToast(message, isError = false) {
  const toast = document.createElement('div');
  const borderColor = isError ? 'border-red-500/30' : 'border-purple-500/30';
  const iconColor = isError ? 'text-red-400' : 'text-purple-400';
  const iconSvg = isError ? `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ` : `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ${iconColor}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `;
  
  toast.className = `fixed bottom-6 right-6 glass border ${borderColor} px-5 py-3 rounded-xl shadow-2xl text-white text-sm z-50 animate-fade-in-up flex items-center gap-2`;
  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

// API Model Listing Helper for debugging
async function debugListModels(apiKey) {
  if (!apiKey) return;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (response.ok) {
      const data = await response.json();
      console.log("Gemini API list of available models for this key:", data.models?.map(m => m.name.replace('models/', '')));
    } else {
      const err = await response.json().catch(() => ({}));
      console.warn("Could not list models: ", err.error?.message || response.statusText);
    }
  } catch (e) {
    console.warn("Could not list models due to network/CORS error:", e);
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupSettingsModal();
  renderHistoryChips();

  const playerPlayBtn = document.getElementById('player-play-btn');
  const playerNextBtn = document.getElementById('player-next-btn');

  if (playerPlayBtn) {
    playerPlayBtn.addEventListener('click', () => {
      playRandomSong();
    });
  }

  if (playerNextBtn) {
    playerNextBtn.addEventListener('click', () => {
      playNext();
    });
  }

  // Toggle Playability Verification Console Panel
  const toggleConsoleBtn = document.getElementById('toggle-console-btn');
  const logsWrapper = document.getElementById('console-logs-wrapper');
  if (toggleConsoleBtn && logsWrapper) {
    toggleConsoleBtn.addEventListener('click', () => {
      if (logsWrapper.classList.contains('max-h-0')) {
        // Show
        logsWrapper.classList.remove('max-h-0', 'opacity-0');
        logsWrapper.classList.add('max-h-96', 'opacity-100');
        toggleConsoleBtn.textContent = 'Hide Logs';
      } else {
        // Hide
        logsWrapper.classList.remove('max-h-96', 'opacity-100');
        logsWrapper.classList.add('max-h-0', 'opacity-0');
        toggleConsoleBtn.textContent = 'Show Logs';
      }
    });
  }

  // Toggle Autoplay State and Style
  const autoplayToggleBtn = document.getElementById('autoplay-toggle-btn');
  const autoplayIndicator = document.getElementById('autoplay-indicator');
  if (autoplayToggleBtn && autoplayIndicator) {
    autoplayToggleBtn.addEventListener('click', () => {
      state.autoplayEnabled = !state.autoplayEnabled;
      
      if (state.autoplayEnabled) {
        // Style Active
        autoplayToggleBtn.className = "glass bg-emerald-950/20 border-emerald-500/30 text-emerald-400 font-semibold px-4 md:px-5 py-2.5 md:py-3.5 rounded-full text-xs md:text-sm tracking-wider uppercase transition-all active:scale-[0.99] flex items-center gap-2 cursor-pointer";
        autoplayIndicator.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
        autoplayToggleBtn.querySelector('span:last-child').textContent = "Autoplay: On";
        showToast("Autoplay enabled");
      } else {
        // Style Inactive
        autoplayToggleBtn.className = "glass border-white/10 text-gray-400 font-semibold px-4 md:px-5 py-2.5 md:py-3.5 rounded-full text-xs md:text-sm tracking-wider uppercase transition-all active:scale-[0.99] flex items-center gap-2 cursor-pointer";
        autoplayIndicator.className = "w-2 h-2 rounded-full bg-gray-500";
        autoplayToggleBtn.querySelector('span:last-child').textContent = "Autoplay: Off";
        showToast("Autoplay disabled");
      }
    });
  }

  const form = document.getElementById('vibe-form');
  const moodInput = document.getElementById('mood-input');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const vibe = moodInput.value.trim();
    if (vibe) {
      handleCuration(vibe);
    }
  });

  moodInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const vibe = moodInput.value.trim();
      if (vibe) {
        handleCuration(vibe);
      }
    }
  });
});
