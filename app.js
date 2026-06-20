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
  const list = fallbackDatabase[category] || fallbackDatabase.chill;
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  
  // Ensure we have exactly 20 songs by backfilling from other categories if necessary
  if (shuffled.length < 20) {
    const allFallbackCategories = Object.keys(fallbackDatabase);
    for (const cat of allFallbackCategories) {
      if (shuffled.length >= 20) break;
      if (cat === category) continue;
      const extraSongs = fallbackDatabase[cat];
      const shuffledExtra = [...extraSongs].sort(() => 0.5 - Math.random());
      for (const song of shuffledExtra) {
        if (shuffled.length >= 20) break;
        if (!shuffled.some(s => s.title === song.title)) {
          shuffled.push(song);
        }
      }
    }
  }
  
  return shuffled.slice(0, 20);
}

// REST call to a single Gemini model with AbortController timeout
async function makeGeminiRequest(model, version, vibe, apiKey, excludedSongs = [], timeoutMs = 15000) {
  let exclusionPrompt = '';
  if (excludedSongs && excludedSongs.length > 0) {
    exclusionPrompt = `\n- DO NOT include any of the following songs: ${excludedSongs.slice(0, 55).join(', ')}.`;
  }

  const prompt = `You are a world-class music curator specializing in Indian music. Analyze the user's emotional state described below, and curate EXACTLY 25 real Hindi songs that match this mood.

CONSTRAINTS:
- Songs MUST be in Hindi (Bollywood, Hindi indie, or Hindi pop/classical). No English songs.
- Song titles and artists must be real and well-known.${exclusionPrompt}
- Return EXACTLY 25 items. Variety is important — mix eras, tempos, and artists.

User mood: "${vibe}"

Output a JSON array. No markdown, no wrapping. Each object:
{"title":"Song Title","artist":"Artist Name","explanation":"1-sentence poetic reason why this matches."}

JSON array:`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from AI engine.");

    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 25);
    }
    throw new Error("AI returned data in an unexpected format.");
  } finally {
    clearTimeout(timer);
  }
}

// Optimized Gemini caller — races top 2 models in parallel for speed
async function curateWithGemini(vibe, apiKey, excludedSongs = []) {
  // Race the two fastest models simultaneously
  const fastModels = [
    { name: 'gemini-2.5-flash', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' }
  ];

  // Fallback models if both fast ones fail
  const fallbackModels = [
    { name: 'gemini-2.0-flash-lite', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1beta' }
  ];

  // Phase 1: Race fast models (whoever responds first wins)
  try {
    console.log('Racing fast models:', fastModels.map(m => m.name).join(' vs '));
    const songs = await Promise.any(
      fastModels.map(m => makeGeminiRequest(m.name, m.version, vibe, apiKey, excludedSongs, 12000))
    );
    console.log(`Fast model race won with ${songs.length} songs`);
    return songs;
  } catch (raceErr) {
    console.warn('Fast model race failed, trying fallback models sequentially:', raceErr);
  }

  // Phase 2: Sequential fallback
  let lastError = null;
  for (const item of fallbackModels) {
    try {
      console.log(`Fallback: trying ${item.name} (${item.version})`);
      const songs = await makeGeminiRequest(item.name, item.version, vibe, apiKey, excludedSongs);
      return songs;
    } catch (err) {
      lastError = err;
      if (err.message?.includes("API key not valid") || err.message?.includes("API_KEY_INVALID")) {
        throw err;
      }
    }
  }
  throw new Error(`All Gemini models failed. Last error: ${lastError?.message || lastError}`);
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
    skeleton.className = 'glass-card fluid-rounded p-5 flex flex-col select-none h-full';
    skeleton.innerHTML = `
      <div class="flex items-center gap-3.5 mb-4">
        <div class="w-[clamp(52px,9vw,68px)] h-[clamp(52px,9vw,68px)] rounded-xl shimmer-bg flex-shrink-0"></div>
        <div class="flex-grow space-y-2">
          <div class="h-3 w-1/2 shimmer-bg rounded-md"></div>
          <div class="h-5 w-3/4 shimmer-bg rounded-md"></div>
          <div class="h-3 w-2/5 shimmer-bg rounded-md"></div>
        </div>
      </div>
      <div class="h-3 w-full shimmer-bg rounded-md mb-2 flex-grow"></div>
      <div class="h-3 w-4/5 shimmer-bg rounded-md mb-4"></div>
      <div class="h-9 w-full shimmer-bg rounded-xl mt-auto"></div>
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
  resultsContainer.classList.remove('hidden');
  
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
    card.className = `glass-card fluid-rounded p-5 flex flex-col animate-fade-in-up opacity-0 relative select-none h-full group`;
    card.style.animationDelay = `${idx * 0.06}s`;
    
    const gradient = getDynamicGradient(song.title, song.artist);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist + ' song')}`;

    card.innerHTML = `
      <!-- Card Header: Art + Number Badge -->
      <div class="flex items-center gap-3.5 mb-4">
        <div class="relative flex-shrink-0">
          <div onclick="playSongAtIndex(${idx})" class="w-[clamp(52px,9vw,68px)] h-[clamp(52px,9vw,68px)] rounded-xl shadow-lg flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-500 group-hover:scale-105" style="background: ${gradient}">
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center rounded-xl">
              <svg class="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-white/80 drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
          </div>
          <!-- Track number badge -->
          <div class="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-purple-500 border-2 border-[#06050b] flex items-center justify-center song-num">
            <span class="text-white font-bold" style="font-size:0.55rem">${idx + 1}</span>
          </div>
        </div>

        <div class="min-w-0 flex-grow">
          <!-- Verified badge -->
          <div class="inline-flex items-center gap-1 mb-1 text-emerald-400 text-[0.6rem] font-semibold uppercase tracking-wider bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Verified
          </div>
          <h3 class="font-display font-bold text-[var(--font-card-title)] text-white leading-tight line-clamp-1 cursor-pointer hover:text-purple-300 transition-colors" title="${song.title}" onclick="playSongAtIndex(${idx})">${song.title}</h3>
          <p class="text-purple-300/80 text-[var(--font-small)] line-clamp-1 leading-tight mt-0.5">${song.artist}</p>
        </div>
      </div>

      <!-- Explanation text -->
      <p class="text-gray-400 text-[var(--font-small)] leading-relaxed italic line-clamp-2 flex-grow mb-4">"${song.explanation}"</p>

      <!-- Action Buttons -->
      <div class="flex gap-2 mt-auto">
        <button onclick="playSongAtIndex(${idx})" class="flex-grow inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold py-2.5 rounded-xl text-[var(--font-small)] uppercase tracking-wider transition-all shadow-md shadow-rose-500/15 hover:shadow-rose-500/30 active:scale-[0.98] cursor-pointer">
          <svg class="h-3.5 w-3.5 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          Play
        </button>
        <a href="${youtubeUrl}" target="_blank" title="Open on YouTube" class="w-10 h-10 inline-flex items-center justify-center rounded-xl glass hover:bg-white/6 border border-white/8 hover:border-white/18 text-gray-400 hover:text-rose-400 transition-all cursor-pointer flex-shrink-0">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.163c-.272-1.022-1.074-1.826-2.099-2.099C19.558 3.5 12 3.5 12 3.5s-7.558 0-9.399.564C.776 4.337-.026 5.141-.298 6.163.224 8.007.224 12 .224 12s0 3.993.522 5.837c.272 1.022 1.074 1.826 2.099 2.099C4.442 20.5 12 20.5 12 20.5s7.558 0 9.399-.564c1.025-.273 1.827-1.077 2.099-2.099.522-1.844.522-5.837.522-5.837s0-3.993-.522-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
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
  buttonText.textContent = 'Curating vibe…';
  buttonIcon.innerHTML = `
    <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

  writeConsoleLog(`Initializing curation for vibe: "${vibe}"`, 'info');

  try {
    const workingSongs = [];
    const excludedSongs = [];
    let attempts = 0;
    const maxAttempts = 4;
    let source = 'gemini';

    if (state.apiKey && state.apiKey.trim()) {
      writeConsoleLog("Starting Gemini multi-batch stream harvest…", "header");
      
      while (workingSongs.length < 20 && attempts < maxAttempts) {
        attempts++;
        writeConsoleLog(`Gemini Curation Attempt #${attempts} (Current Playable Count: ${workingSongs.length}/20)`, "info");
        
        let candidates = [];
        try {
          candidates = await curateWithGemini(vibe, state.apiKey, excludedSongs);
          writeConsoleLog(`Received ${candidates.length} song recommendations from Gemini.`, "pass");
        } catch (err) {
          console.warn("Gemini curation failed:", err);
          writeConsoleLog(`Gemini API call failed: ${err.message || err}`, "warn");
          
          if (workingSongs.length === 0) {
            showToast(`Gemini API Error: ${err.message || err}. Using offline demo fallback.`, true);
            writeConsoleLog("Falling back to local database.", "warn");
            const fallbackSongs = curateFallback(vibe);
            source = 'mock';
            
            // Verify fallback songs
            const BATCH_SIZE = 5;
            for (let i = 0; i < fallbackSongs.length; i += BATCH_SIZE) {
              const batch = fallbackSongs.slice(i, i + BATCH_SIZE);
              const batchPromises = batch.map(async (song) => {
                try {
                  const query = `${song.title} ${song.artist} song`;
                  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                  if (response.ok) {
                    const data = await response.json();
                    if (data.videoId) {
                      song.videoId = data.videoId;
                      workingSongs.push(song);
                    }
                  }
                } catch (e) {}
              });
              await Promise.all(batchPromises);
            }
          }
          break; // break the while loop
        }

        // Add candidate titles to exclude list for next loop iterations
        candidates.forEach(s => {
          if (s.title) excludedSongs.push(s.title);
        });

        // Verify this batch
        writeConsoleLog(`Verifying batch of ${candidates.length} songs…`, "info");
        
        const BATCH_SIZE = 5;
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
          if (workingSongs.length >= 20) break;

          const batch = candidates.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (song) => {
            if (workingSongs.length >= 20) return;

            const trackId = `"${song.title}"`;
            try {
              const query = `${song.title} ${song.artist} song`;
              writeConsoleLog(`Checking: ${trackId} by ${song.artist}`, "info");
              
              const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
              if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates.length > 0) {
                  data.candidates.forEach((cand, cIdx) => {
                    const status = cand.ok 
                      ? "PLAYABLE" 
                      : `UNPLAYABLE (${cand.status}${cand.reason ? ': ' + cand.reason : ''})`;
                    writeConsoleLog(`  [Cand ${cIdx+1}] ${cand.videoId} → ${status}`, cand.ok ? "pass" : "fail");
                  });
                }
                if (data.videoId) {
                  song.videoId = data.videoId;
                  workingSongs.push(song);
                  writeConsoleLog(`✓ [${workingSongs.length}/20] ${trackId} → ${data.videoId}`, "pass");
                  buttonText.textContent = `Verified ${workingSongs.length} songs…`;
                } else {
                  song.videoId = null;
                  writeConsoleLog(`✗ ${trackId} — no embeddable video found`, "fail");
                }
              } else {
                song.videoId = null;
                writeConsoleLog(`✗ ${trackId} — search API error`, "fail");
              }
            } catch (err) {
              song.videoId = null;
              writeConsoleLog(`✗ ${trackId} — network error: ${err.message}`, "fail");
            }
          });
          await Promise.all(batchPromises);
        }

        if (workingSongs.length >= 20) {
          writeConsoleLog("Collected target 20 verified playable songs!", "pass");
          break;
        }
      }
    } else {
      writeConsoleLog("No API Key configured. Accessing local database…", "warn");
      await new Promise(resolve => setTimeout(resolve, 400));
      const fallbackSongs = curateFallback(vibe);
      source = 'mock';
      writeConsoleLog(`Loaded ${fallbackSongs.length} songs from local fallback database.`, "pass");
      
      // Verify mock songs
      writeConsoleLog("Verifying fallback songs playability...", "info");
      const BATCH_SIZE = 5;
      for (let i = 0; i < fallbackSongs.length; i += BATCH_SIZE) {
        const batch = fallbackSongs.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (song) => {
          try {
            const query = `${song.title} ${song.artist} song`;
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (response.ok) {
              const data = await response.json();
              if (data.videoId) {
                song.videoId = data.videoId;
                workingSongs.push(song);
              }
            }
          } catch (e) {}
        });
        await Promise.all(batchPromises);
      }
    }

    // Limit active list to exactly 20 songs
    const finalPlaylist = workingSongs.slice(0, 20);

    writeConsoleLog("Playability Validation Complete", "header");
    writeConsoleLog(`Results: Total ${finalPlaylist.length} verified playable songs presented.`, "info");

    if (finalPlaylist.length === 0) {
      writeConsoleLog("CRITICAL: Zero playable streams found.", "fail");
      throw new Error("Could not resolve any working video streams. Please try another mood description.");
    }

    renderSongs(finalPlaylist, source);
    applyAmbientTheme(vibe);
    
    // Auto Play random song
    writeConsoleLog("Curation complete. Launching a random track.", "info");
    playRandomSong();
  } catch (error) {
    console.error("Curation handler error:", error);
    renderError(error.message);
  } finally {
    state.curating = false;
    button.disabled = false;
    button.classList.remove('opacity-85', 'cursor-not-allowed');
    buttonText.textContent = 'Curate Music';
    buttonIcon.innerHTML = `
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
  if (!badge) return;
  badge.classList.remove('hidden');
  if (key) {
    badge.className = "sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[var(--font-small)] font-semibold bg-emerald-950/50 border border-emerald-500/25 text-emerald-300";
    badge.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      Gemini Active
    `;
  } else {
    badge.className = "sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[var(--font-small)] font-semibold bg-purple-950/50 border border-purple-500/25 text-purple-300";
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

  // Initialize Tarang Voice Assistant Widget UI State
  initTarangWidgetUI();

  // Wire up manual mic trigger
  const micContainer = document.getElementById('tarang-mic-container');
  if (micContainer) {
    micContainer.addEventListener('click', () => {
      handleTarangMicClick();
    });
  }
});

// ==========================================
// Tarang Voice Assistant — Always-On Engine
// (Single continuous recognizer, Siri/Google style)
let tarangRecognizer = null;      // The one and only recognizer instance
let audioCtx = null;
let analyserNode = null;
let visualizerFrameId = null;
let vizStream = null;
let tarangEnabled = true;          // Is the assistant toggled ON?
let tarangActive = false;          // Is the microphone engine active?
let tarangWake = false;            // Is the assistant awake/conversational?
let tarangSpeaking = false;        // Is TTS playing? (block re-listen while speaking)
let tarangDetectedLang = 'en';     // Last detected language
let tarangMoodBuffer = '';         // Accumulated mood description from voice
let tarangSilenceTimer = null;     // 2s silence detector timer
let tarangNetworkRetryDelay = 200; // Restart delay in ms (backs off on network error)

// Gemini Backend Transcription Fallback State
let useBackendTranscription = false;
let isCommandMode = false;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let lastSpeechTime = 0;
let hasUserSpoken = false;
let maxRecordingTimeout = null;

// Music volume ducking when assistant is awake/speaking
let originalPlayerVolume = 80;

function duckMusic() {
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
    try {
      originalPlayerVolume = ytPlayer.getVolume() || 80;
      ytPlayer.setVolume(15); // Duck to 15% volume
      console.log(`[Tarang Jarvis] Ducking music volume to 15% (was ${originalPlayerVolume}%)`);
    } catch (e) {}
  }
}

function unduckMusic() {
  if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
    try {
      ytPlayer.setVolume(originalPlayerVolume);
      console.log(`[Tarang Jarvis] Restoring music volume to ${originalPlayerVolume}%`);
    } catch (e) {}
  }
}

// 1. INIT
function initTarangWidgetUI() {
  const savedEnabled = localStorage.getItem('tarang_enabled');
  tarangEnabled = (savedEnabled !== 'false'); // Default to true

  const toggleEl = document.getElementById('tarang-toggle');
  if (toggleEl) {
    toggleEl.checked = tarangEnabled;
    // Remove previous listeners if any (by replacing toggle node, or just attaching cleanly)
    toggleEl.addEventListener('change', (e) => {
      tarangEnabled = e.target.checked;
      localStorage.setItem('tarang_enabled', tarangEnabled ? 'true' : 'false');
      if (tarangEnabled) {
        tarangStart();
      } else {
        tarangStop();
      }
    });
  }

  if (tarangEnabled) {
    tarangStart();
  } else {
    setTarangState('disabled');
  }
}

// 2. MIC BUTTON CLICK
async function handleTarangMicClick() {
  if (!tarangEnabled) {
    showToast('Please enable Tarang Voice Assistant using the toggle switch first.', false);
    return;
  }

  if (useBackendTranscription) {
    if (tarangSpeaking) {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      tarangSpeaking = false;
      playChime('error');
      setTarangState('passive_listening');
      return;
    }
    
    if (isRecording) {
      // User tapped the mic button while recording -> Manual stop!
      stopRecording();
      return;
    }
    
    if (state.tarangState === 'waiting_for_curate') {
      // Command mode
      isCommandMode = true;
      playChime('start');
      setTarangState('listening_mood');
      const transcriptEl = document.getElementById('tarang-transcript');
      if (transcriptEl) transcriptEl.textContent = 'Speak command now...';
      startRecording();
    } else {
      // Check if mood is already set
      const moodInput = document.getElementById('mood-input');
      const hasMood = moodInput && moodInput.value.trim().length > 0;
      if (hasMood) {
        isCommandMode = true;
        playChime('start');
        setTarangState('listening_mood');
        const transcriptEl = document.getElementById('tarang-transcript');
        if (transcriptEl) transcriptEl.textContent = 'Speak command now...';
        startRecording();
      } else {
        triggerWakeUp();
      }
    }
  } else {
    if (tarangWake) {
      // Put to sleep
      tarangWake = false;
      playChime('error');
      setTarangState('passive_listening');
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      
      // Restart in passive listening mode
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) tarangStartListening(SR);
    } else {
      // Wake up
      triggerWakeUp();
    }
  }
}

// 3. START — Start background passive listening
async function tarangStart() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition && !useBackendTranscription) {
    console.warn("SpeechRecognition not supported in browser. Switching to backend transcription fallback.");
    useBackendTranscription = true;
  }

  tarangEnabled = true;
  tarangActive = true;
  tarangWake = false;
  tarangMoodBuffer = '';
  setTarangState('passive_listening');

  // Request mic stream for visualizer & recorder
  try {
    if (!vizStream) {
      vizStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      startVisualizer(vizStream);
    }
  } catch (e) {
    console.warn('Visualizer mic denied/failed:', e);
    showToast('Microphone access denied. Please allow mic permissions.', true);
    tarangStop();
    return;
  }

  if (useBackendTranscription) {
    console.log('[Tarang] Running in Gemini backend transcription fallback mode (Tap-to-Speak).');
    setTarangState('passive_listening');
  } else {
    tarangStartListening(SpeechRecognition);
  }
}

// 4. ALWAYS-ON CONTINUOUS RECOGNIZER
function tarangStartListening(SpeechRecognition) {
  if (!tarangEnabled || !tarangActive) return;
  if (tarangSpeaking) return;

  if (useBackendTranscription) {
    // Branch off and do not initialize standard SpeechRecognition
    return;
  }

  if (tarangRecognizer) {
    try { tarangRecognizer.abort(); } catch(e) {}
    tarangRecognizer = null;
  }

  try {
    tarangRecognizer = new SpeechRecognition();
    tarangRecognizer.continuous = true;
    tarangRecognizer.interimResults = true;
    tarangRecognizer.maxAlternatives = 1;
    tarangRecognizer.lang = navigator.language || 'en-IN';

    const moodInput = document.getElementById('mood-input');
    const transcriptEl = document.getElementById('tarang-transcript');

    tarangRecognizer.onstart = () => {
      if (tarangWake) {
        if (state.tarangState === 'greeting') {
          setTarangState('greeting');
        } else if (state.tarangState === 'listening_mood') {
          setTarangState('listening_mood');
        } else {
          setTarangState('waiting_for_curate');
        }
      } else {
        setTarangState('passive_listening');
      }
      console.log('[Tarang] Recognizer started in state:', state.tarangState);
    };

    tarangRecognizer.onresult = (event) => {
      let interim = '';
      let justFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          justFinal += t;
        } else {
          interim += t;
        }
      }

      // Realtime console acknowledgement of heard speech
      console.log(`[Tarang Live Speech Heard] Interim: "${interim}" | Final: "${justFinal}"`);

      // Reset network backoff delay on successful recognition results
      tarangNetworkRetryDelay = 200;

      // Check for wake words anytime (flexible wake up, stops other tasks)
      const spoken = (justFinal + ' ' + interim).toLowerCase();
      const wakeWords = ['tarang', 'taran', 'tarun', 'taranga', 'terang', 'hello assistant', 'hey assistant', 'jarvis', 'wake up', 'wake-up', 'chalu ho', 'chalo'];
      const heardWakeWord = wakeWords.some(w => spoken.includes(w));

      if (heardWakeWord && !tarangSpeaking && state.tarangState !== 'greeting') {
        console.log(`[Tarang Jarvis] Continuous Wake word intercepted in spoken text: "${spoken}"`);
        if (typeof speechSynthesis !== 'undefined') {
          speechSynthesis.cancel();
        }
        triggerWakeUp();
        return;
      }

      // Check awake status
      if (!tarangWake) {
        // If not awake and no wake word, ignore speech input
        return;
      } else {
        // AWAKE
        if (state.tarangState === 'listening_mood') {
          // Live transcribing user's mood
          const currentSpeech = (justFinal || interim).trim();
          if (currentSpeech) {
            // Give live acknowledgement of transcribing
            const statusEl = document.getElementById('tarang-status');
            if (statusEl) statusEl.textContent = 'Transcribing mood...';
            
            if (transcriptEl) {
              transcriptEl.textContent = currentSpeech;
            }
          }

          if (justFinal) {
            // Append final results to mood buffer
            tarangMoodBuffer = (tarangMoodBuffer + ' ' + justFinal.trim()).trim();
            if (moodInput) {
              moodInput.value = tarangMoodBuffer;
              moodInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }

          // Reset silence timer on any speech input
          if (tarangSilenceTimer) clearTimeout(tarangSilenceTimer);
          if (interim.trim() || justFinal.trim() || tarangMoodBuffer.trim()) {
            tarangSilenceTimer = setTimeout(() => {
              commitMoodAndStopListening();
            }, 1200); // 1.2s silence detector
          }
        } else if (state.tarangState === 'waiting_for_curate') {
          if (justFinal) {
            routeTarangCommand(justFinal.trim().toLowerCase());
          }
        }
      }
    };

    tarangRecognizer.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('[Tarang] Recognition error:', event.error);
      
      // SWITCH TO BACKEND TRANSCRIPTION ON NETWORK ERROR
      if (event.error === 'network') {
        console.warn(`[Tarang] Speech recognition network error detected. Switching to Gemini Backend Transcription fallback!`);
        showToast('Speech recognition network error. Switching to Gemini fallback...', false);
        useBackendTranscription = true;
        
        // Stop current recognizer and transition
        tarangWake = false;
        if (tarangRecognizer) {
          try { tarangRecognizer.abort(); } catch(e) {}
          tarangRecognizer = null;
        }
        
        // Restart in backend fallback mode
        tarangStart();
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showToast('Microphone access denied. Please allow mic permissions.', true);
        tarangStop();
      }
    };

    tarangRecognizer.onend = () => {
      console.log('[Tarang] Recognizer ended. Active:', tarangActive, 'Speaking:', tarangSpeaking);
      if (tarangEnabled && tarangActive && !tarangSpeaking) {
        // Use backoff delay if set, otherwise standard 200ms
        const delay = tarangNetworkRetryDelay;
        setTimeout(() => {
          if (tarangEnabled && tarangActive && !tarangSpeaking) {
            tarangStartListening(SpeechRecognition);
          }
        }, delay);
      }
    };

    tarangRecognizer.start();

  } catch (err) {
    console.error('[Tarang] Could not start recognizer:', err);
    showToast('Could not start microphone. Check permissions.', true);
    tarangStop();
  }
}

// 5. TRIGGER WAKE UP
async function triggerWakeUp() {
  tarangWake = true;
  tarangMoodBuffer = '';
  
  if (tarangRecognizer) {
    try { tarangRecognizer.abort(); } catch(e) {}
    tarangRecognizer = null;
  }
  
  setTarangState('greeting');
  playChime('start');
  duckMusic();
  
  await tarangSpeak("Hello Sir, please tell me your mood right now.", 'en');
  if (!tarangEnabled || !tarangWake) return; // check if stopped/cancelled
  
  // Clear any existing mood in field
  const moodInput = document.getElementById('mood-input');
  if (moodInput) {
    moodInput.value = '';
    moodInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const transcriptEl = document.getElementById('tarang-transcript');
  if (transcriptEl) transcriptEl.textContent = 'Speak your mood now';
  
  setTarangState('listening_mood');
  
  if (useBackendTranscription) {
    startRecording();
  } else {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) tarangStartListening(SR);
  }
}

// 6. COMMIT MOOD ONCE USER STOPS SPEAKING (SILENCE DETECTED)
async function commitMoodAndStopListening() {
  if (tarangSilenceTimer) clearTimeout(tarangSilenceTimer);
  tarangSilenceTimer = null;

  tarangSpeaking = true;
  if (tarangRecognizer) {
    try { tarangRecognizer.abort(); } catch(e) {}
    tarangRecognizer = null;
  }

  playChime('success');
  setTarangState('waiting_for_curate');

  const moodInput = document.getElementById('mood-input');
  const finalMood = moodInput ? moodInput.value.trim() : '';
  tarangDetectedLang = detectTextLanguage(finalMood);

  let ackText = "I've noted your mood. You can verify it and say 'Curate my mood' when ready.";
  if (tarangDetectedLang === 'hi') {
    ackText = "मैंने आपका मूड नोट कर लिया है। आप 'क्यूरेट माय मूड' बोलकर संगीत शुरू कर सकते हैं।";
  } else if (tarangDetectedLang === 'gu') {
    ackText = "મેં તમારો મૂડ નોંધી લીધો છે. તમે 'ક્યુરેટ માય મૂડ' બોલીને સંગીત શરૂ કરી શકો છો.";
  }

  const transcriptEl = document.getElementById('tarang-transcript');
  if (transcriptEl) {
    transcriptEl.textContent = finalMood || "Mood captured";
  }

  await tarangSpeak(ackText, tarangDetectedLang);
  tarangSpeaking = false;
  unduckMusic();

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && tarangEnabled && tarangWake) {
    tarangStartListening(SR);
  }
}

// 6b. BACKEND RECORDING FUNCTIONS (FALLBACK MODE)
// Start MediaRecorder recording
function startRecording() {
  if (!vizStream) {
    console.warn("No mic stream available for recording.");
    return;
  }
  
  audioChunks = [];
  try {
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = {}; // fallback to default
    }
    
    mediaRecorder = new MediaRecorder(vizStream, options);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      console.log(`[Tarang Recording] Finished. Blob size: ${audioBlob.size} bytes. MimeType: ${mimeType}`);
      uploadAndTranscribe(audioBlob, mimeType);
    };
    
    mediaRecorder.start(100); // deliver data chunks every 100ms
    isRecording = true;
    hasUserSpoken = false;
    lastSpeechTime = Date.now();
    console.log("[Tarang Recording] Started MediaRecorder.");
    
    // Set a safeguard timeout (20s max recording)
    if (maxRecordingTimeout) clearTimeout(maxRecordingTimeout);
    maxRecordingTimeout = setTimeout(() => {
      if (isRecording) {
        console.log("[Tarang Recording] Max recording limit reached (20s). Stopping.");
        stopRecording();
      }
    }, 20000);
    
  } catch (err) {
    console.error("[Tarang Recording] Failed to start MediaRecorder:", err);
    showToast("Could not start audio recorder.", true);
  }
}

// Stop MediaRecorder recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  isRecording = false;
  if (maxRecordingTimeout) {
    clearTimeout(maxRecordingTimeout);
    maxRecordingTimeout = null;
  }
}

// Convert Blob to base64 and upload to backend
function uploadAndTranscribe(audioBlob, mimeType) {
  setTarangState('processing');
  
  if (!state.apiKey) {
    showToast("Please set your Gemini API key in settings to use voice transcription.", true);
    playChime('error');
    setTarangState('passive_listening');
    tarangSpeak("Please configure your Gemini API key in settings to enable this feature.", 'en');
    isCommandMode = false;
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);
  reader.onloadend = async () => {
    try {
      const base64data = reader.result.split(',')[1];
      
      const requestPayload = {
        audio: base64data,
        mimeType: mimeType,
        apiKey: state.apiKey
      };
      
      if (isCommandMode) {
        console.log("[Tarang] Sending audio to /api/transcribe...");
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const transcribedText = (data.transcript || '').trim();
        const detectedLang = data.language || 'en';
        
        console.log(`[Tarang Backend Transcription] Result: "${transcribedText}" (Lang: ${detectedLang})`);
        
        isCommandMode = false;
        if (transcribedText) {
          const transcriptEl = document.getElementById('tarang-transcript');
          if (transcriptEl) transcriptEl.textContent = transcribedText;
          routeTarangCommand(transcribedText);
        } else {
          tarangRespondAndListen("I didn't hear any command. Please try again.", 'en');
        }
      } else {
        console.log("[Tarang] Sending audio to /api/voice-curate...");
        const response = await fetch('/api/voice-curate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const songs = data.songs || [];
        const voiceResponse = data.voiceResponse || "";
        const detectedLang = data.detectedLanguage || "en";
        const detectedMood = data.detectedMood || "";
        
        console.log(`[Tarang Backend Voice Curation] Mood: "${detectedMood}" | Lang: "${detectedLang}" | Songs Count: ${songs.length}`);
        
        if (songs.length > 0) {
          const moodInput = document.getElementById('mood-input');
          if (moodInput) {
            moodInput.value = detectedMood;
            moodInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          tarangDetectedLang = detectedLang;
          
          // Commit mood and play success chime
          tarangSpeaking = true;
          playChime('success');
          setTarangState('greeting');
          
          const transcriptEl = document.getElementById('tarang-transcript');
          if (transcriptEl) {
            transcriptEl.textContent = `Mood: ${detectedMood}`;
          }
          
          await tarangSpeak(voiceResponse, detectedLang);
          tarangSpeaking = false;
          unduckMusic();
          
          // Verify playability of the returned songs in parallel!
          await verifyAndPlayVoiceCuration(songs, detectedMood);
        } else {
          playChime('error');
          setTarangState('passive_listening');
          await tarangSpeak("Sorry, I could not curate any songs for your mood. Please try again.", 'en');
          unduckMusic();
        }
      }
    } catch (err) {
      console.error("[Tarang Voice Pipeline] Failure:", err);
      showToast("Voice curation failed: " + (err.message || err), true);
      playChime('error');
      setTarangState('passive_listening');
      await tarangSpeak("Sorry, there was an error processing your voice input. Please try again.", 'en');
      isCommandMode = false;
      unduckMusic();
    }
  };
}

// Verify playability of voice-curated candidates and load them into active playback
async function verifyAndPlayVoiceCuration(candidates, vibe) {
  if (state.curating) return;
  
  state.curating = true;
  const button = document.getElementById('curate-btn');
  const buttonText = document.getElementById('btn-text');
  const buttonIcon = document.getElementById('btn-icon');
  
  if (button && buttonText && buttonIcon) {
    button.disabled = true;
    button.classList.add('opacity-85', 'cursor-not-allowed');
    buttonText.textContent = 'Curating vibe…';
    buttonIcon.innerHTML = `
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    `;
  }
  
  renderSkeleton();
  saveVibeToHistory(vibe);
  
  const consolePanel = document.getElementById('verification-console-panel');
  const consoleLogs = document.getElementById('console-logs');
  if (consolePanel) consolePanel.classList.remove('hidden');
  if (consoleLogs) consoleLogs.innerHTML = '';
  
  writeConsoleLog(`Initializing playability validation for Voice-Curated songs: "${vibe}"`, 'info');
  writeConsoleLog("Verifying recommendations list…", "header");
  
  try {
    const workingSongs = [];
    
    // Verify candidates batch-by-batch
    const BATCH_SIZE = 5;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      if (workingSongs.length >= 20) break;
      
      const batch = candidates.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (song) => {
        if (workingSongs.length >= 20) return;
        
        const trackId = `"${song.title}"`;
        try {
          const query = `${song.title} ${song.artist} song`;
          writeConsoleLog(`Checking: ${trackId} by ${song.artist}`, "info");
          
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
              data.candidates.forEach((cand, cIdx) => {
                const status = cand.ok 
                  ? "PLAYABLE" 
                  : `UNPLAYABLE (${cand.status}${cand.reason ? ': ' + cand.reason : ''})`;
                writeConsoleLog(`  [Cand ${cIdx+1}] ${cand.videoId} → ${status}`, cand.ok ? "pass" : "fail");
              });
            }
            if (data.videoId) {
              song.videoId = data.videoId;
              workingSongs.push(song);
              writeConsoleLog(`✓ [${workingSongs.length}/20] ${trackId} → ${data.videoId}`, "pass");
              if (buttonText) buttonText.textContent = `Verified ${workingSongs.length} songs…`;
            } else {
              song.videoId = null;
              writeConsoleLog(`✗ ${trackId} — no embeddable video found`, "fail");
            }
          } else {
            song.videoId = null;
            writeConsoleLog(`✗ ${trackId} — search API error`, "fail");
          }
        } catch (err) {
          song.videoId = null;
          writeConsoleLog(`✗ ${trackId} — network error: ${err.message}`, "fail");
        }
      });
      await Promise.all(batchPromises);
    }
    
    const finalPlaylist = workingSongs.slice(0, 20);
    writeConsoleLog("Playability Validation Complete", "header");
    writeConsoleLog(`Results: Total ${finalPlaylist.length} verified playable songs presented.`, "info");
    
    if (finalPlaylist.length === 0) {
      writeConsoleLog("CRITICAL: Zero playable streams found.", "fail");
      throw new Error("Could not resolve any working video streams. Please try another mood description.");
    }
    
    renderSongs(finalPlaylist, 'gemini');
    applyAmbientTheme(vibe);
    
    writeConsoleLog("Voice curation complete. Launching playback.", "info");
    playRandomSong();
    
  } catch (error) {
    console.error("Voice curation validation error:", error);
    renderError(error.message);
  } finally {
    state.curating = false;
    if (button && buttonText && buttonIcon) {
      button.disabled = false;
      button.classList.remove('opacity-85', 'cursor-not-allowed');
      buttonText.textContent = 'Curate Music';
      buttonIcon.innerHTML = `
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      `;
    }
  }
}

// 7. COMMAND ROUTER
function routeTarangCommand(text) {
  // Stop / Pause
  const stopWords = ['stop', 'pause', 'ruk', 'ruko', 'band', 'bandh', 'band karo', 'bandh karo', 'roko', 'stop music', 'pause music'];
  if (stopWords.some(w => text.includes(w))) {
    if (ytPlayer && ytPlayer.pauseVideo) {
      try { ytPlayer.pauseVideo(); } catch(e) {}
    }
    tarangRespondAndListen('Music paused.', 'en');
    return;
  }

  // Resume / Play
  const resumeWords = ['resume', 'unpause', 'continue playing', 'play music'];
  if (resumeWords.some(w => text.includes(w))) {
    if (ytPlayer && ytPlayer.playVideo) {
      try { ytPlayer.playVideo(); } catch(e) {}
    }
    tarangRespondAndListen('Resuming.', 'en');
    return;
  }

  // Next / Skip
  const nextWords = ['next', 'next song', 'skip', 'agle', 'agla', 'badlo', 'aagad', 'skip song', 'next track'];
  if (nextWords.some(w => text.includes(w))) {
    playNext();
    const msg = tarangDetectedLang === 'hi' ? 'अगला गाना चला रहा हूँ।' : tarangDetectedLang === 'gu' ? 'આગળ ગીત ચાલી રહ્યું છે.' : 'Playing next song.';
    tarangRespondAndListen(msg, tarangDetectedLang);
    return;
  }

  // Random
  const randomWords = ['random', 'shuffle', 'any song', 'play something', 'koi bhi', 'koi bi'];
  if (randomWords.some(w => text.includes(w))) {
    playRandomSong();
    tarangRespondAndListen('Playing a random song.', 'en');
    return;
  }

  // Curate my mood
  const lowerText = text.toLowerCase();
  const curateKeywords = [
    'curate', 'let\'s curate', 'lets curate', 'curate my mood', 'curate my mode', 
    'suggest songs', 'play songs', 'suggest track', 'find songs', 'get songs', 
    'songs based on', 'mode description', 'gaane bajao', 'gana bajao', 'gaane sunao', 
    'music lagao', 'baja do', 'bajao', 'gaane lagao', 'play music', 'suggest music',
    'curate music', 'curate mode', 'curate mood'
  ];

  const matchesCuration = curateKeywords.some(w => lowerText.includes(w)) ||
                          (lowerText.includes('curate') && (lowerText.includes('mood') || lowerText.includes('mode'))) ||
                          (lowerText.includes('suggest') && (lowerText.includes('song') || lowerText.includes('music') || lowerText.includes('track') || lowerText.includes('playlist'))) ||
                          (lowerText.includes('let\'s') && lowerText.includes('curate')) ||
                          (lowerText.includes('lets') && lowerText.includes('curate'));

  if (matchesCuration) {
    const moodInput = document.getElementById('mood-input');
    const moodText = moodInput ? moodInput.value.trim() : '';
    if (!moodText) {
      // Empty validation: Ask and transition to listening_mood
      tarangSpeaking = true;
      if (tarangRecognizer) { try { tarangRecognizer.abort(); } catch(e) {} tarangRecognizer = null; }
      duckMusic();
      
      tarangSpeak("First Tell me your mood, then I'll curate it.", 'en').then(() => {
        tarangSpeaking = false;
        tarangMoodBuffer = '';
        if (moodInput) moodInput.value = '';
        const transcriptEl = document.getElementById('tarang-transcript');
        if (transcriptEl) transcriptEl.textContent = 'Speak your mood now';
        setTarangState('listening_mood');
        
        if (useBackendTranscription) {
          startRecording();
        } else {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SR && tarangEnabled && tarangWake) tarangStartListening(SR);
        }
      });
    } else {
      triggerCurationFromVoice();
    }
    return;
  }

  // Play specific song
  const playSpecificMatch = text.match(/^(?:play|baja|laga|sun|sunao|chalao)\s+(.+)$/i);
  if (playSpecificMatch && playSpecificMatch[1] && playSpecificMatch[1].length > 2) {
    const songName = playSpecificMatch[1].trim();
    if (!['music', 'songs', 'song', 'something', 'random', 'shuffle', 'curate', 'my mood'].includes(songName)) {
      tarangPlaySpecificSong(songName);
      return;
    }
  }

  // Sleep / Turn off
  const offWords = ['goodbye tarang', 'bye tarang', 'stop listening', 'sleep', 'go to sleep', 'so jao', 'bye', 'goodbye'];
  if (offWords.some(w => text.includes(w))) {
    tarangRespondAndListen('Goodbye! Wake me up anytime.', 'en').then(() => {
      tarangWake = false;
      setTarangState('passive_listening');
    });
    return;
  }

  // Treat anything else as addition to mood description if they are in passive/command state and say something
  const statusEl = document.getElementById('tarang-status');
  if (statusEl && state.tarangState === 'waiting_for_curate') {
    statusEl.textContent = 'Say "Curate my mood"';
  }
}

// 8. PLAY SPECIFIC SONG BY NAME
async function tarangPlaySpecificSong(songName) {
  setTarangState('processing');

  tarangSpeaking = true;
  if (tarangRecognizer) { try { tarangRecognizer.abort(); } catch(e) {} tarangRecognizer = null; }

  await tarangSpeak(`Looking for ${songName} on YouTube.`, 'en');
  tarangSpeaking = false;

  writeConsoleLog(`Voice: Searching for specific song — "${songName}"`, 'info');

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(songName + ' song')}`);
    const data = await response.json();
    if (data.videoId) {
      const tempSong = { title: songName, artist: 'As Requested', videoId: data.videoId, explanation: 'Played by your voice command.' };
      state.playlist.unshift(tempSong);
      playSongAtIndex(0);

      const msg = `Playing ${songName} now!`;
      await tarangSpeak(msg, 'en');
    } else {
      await tarangSpeak(`Sorry, I couldn't find ${songName} on YouTube.`, 'en');
    }
  } catch (e) {
    await tarangSpeak(`Network error searching for ${songName}.`, 'en');
  } finally {
    tarangSpeaking = false;
    if (tarangEnabled && tarangActive) {
      if (useBackendTranscription) {
        setTarangState('waiting_for_curate');
      } else {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) tarangStartListening(SR);
      }
    }
  }
}

// 9. RESPOND AND RESUME LISTENING
async function tarangRespondAndListen(text, lang) {
  tarangSpeaking = true;
  setTarangState('greeting');

  if (tarangRecognizer) { try { tarangRecognizer.abort(); } catch(e) {} tarangRecognizer = null; }

  await tarangSpeak(text, lang || tarangDetectedLang);

  tarangSpeaking = false;
  if (tarangEnabled && tarangActive) {
    if (useBackendTranscription) {
      setTarangState('waiting_for_curate');
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) tarangStartListening(SR);
    }
  }
}

// 10. SPEAK TEXT (TTS)
function tarangSpeak(text, langCode) {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') { resolve(); return; }

    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    let voiceLang = 'en-IN';
    if (langCode === 'hi') voiceLang = 'hi-IN';
    if (langCode === 'gu') voiceLang = 'gu-IN';
    utter.lang = voiceLang;
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    const voices = speechSynthesis.getVoices();
    const pick = voices.find(v => v.lang.startsWith(voiceLang))
                 || voices.find(v => v.lang.startsWith(langCode))
                 || voices.find(v => v.lang.startsWith('en'))
                 || voices[0];
    if (pick) utter.voice = pick;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    const timeout = setTimeout(() => resolve(), 10000);
    utter.onend = () => { clearTimeout(timeout); resolve(); };

    speechSynthesis.speak(utter);
  });
}

// 11. STOP THE ASSISTANT COMPLETELY
function tarangStop() {
  tarangActive = false;
  tarangWake = false;
  tarangSpeaking = false;
  tarangEnabled = false;

  if (isRecording) {
    stopRecording();
  }

  const toggleEl = document.getElementById('tarang-toggle');
  if (toggleEl) {
    toggleEl.checked = false;
  }
  localStorage.setItem('tarang_enabled', 'false');
  
  if (tarangSilenceTimer) {
    clearTimeout(tarangSilenceTimer);
    tarangSilenceTimer = null;
  }

  if (tarangRecognizer) {
    try { tarangRecognizer.abort(); } catch(e) {}
    tarangRecognizer = null;
  }

  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();

  stopVisualizer();
  if (vizStream) {
    vizStream.getTracks().forEach(t => t.stop());
    vizStream = null;
  }

  setTarangState('disabled');
  playChime('error');
  console.log('[Tarang] Stopped.');
}

// 12. TRIGGER CURATION FROM VOICE
async function triggerCurationFromVoice() {
  const moodInput = document.getElementById('mood-input');
  const moodText = moodInput ? moodInput.value.trim() : '';

  if (!moodText) {
    tarangRespondAndListen("First Tell me your mood, then I'll curate it.", 'en');
    return;
  }

  playChime('success');
  tarangSpeaking = true;
  if (tarangRecognizer) { try { tarangRecognizer.abort(); } catch(e) {} tarangRecognizer = null; }

  const confirmText = tarangDetectedLang === 'hi'
    ? 'जी बिलकुल! अभी आपके मूड के लिए गाने खोज रहा हूँ।'
    : tarangDetectedLang === 'gu'
    ? 'ચોક્કસ! હમણાં જ તમારા મૂડ માટે ગીતો શોધું છું.'
    : 'Got it! Curating your perfect playlist right now.';

  await tarangSpeak(confirmText, tarangDetectedLang);
  tarangSpeaking = false;

  setTarangState('idle');
  handleCuration(moodText);
}

// 13. LEGACY SHIMS
function stopAllVoiceSynthesizersAndRecognizers() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  if (tarangRecognizer) { try { tarangRecognizer.abort(); } catch(e) {} tarangRecognizer = null; }
}

// 14. UI STATE MACHINE
function setTarangState(stateName) {
  state.tarangState = stateName;
  const statusEl = document.getElementById('tarang-status');
  const transcriptEl = document.getElementById('tarang-transcript');
  const dotEl = document.getElementById('tarang-state-dot');
  const micContainer = document.getElementById('tarang-mic-container');
  const bars = document.getElementById('tarang-bars');
  const micIcon = document.getElementById('tarang-mic-icon');
  const widget = document.getElementById('tarang-widget');

  if (!statusEl || !dotEl || !micContainer || !widget) return;

  const BASE_MIC = 'relative w-[3.25rem] h-[3.25rem] rounded-full flex items-center justify-center border shadow-lg cursor-pointer overflow-hidden transition-all duration-400';
  if (bars) bars.classList.add('hidden');
  widget.classList.remove('disabled');

  if (stateName === 'disabled') {
    widget.classList.add('disabled');
    const toggleEl = document.getElementById('tarang-toggle');
    if (toggleEl) toggleEl.checked = false;
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-zinc-600 border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-zinc-950/20 border-zinc-800/30 cursor-not-allowed`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-zinc-600 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = 'Assistant Disabled';
    transcriptEl.textContent = 'Turn on toggle switch';

  } else if (stateName === 'passive_listening') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-purple-950/40 border-purple-500/20`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-purple-400 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = useBackendTranscription ? 'Assistant Active' : 'Listening for "Hey Tarang"...';
    transcriptEl.textContent = useBackendTranscription ? 'Click mic button to speak' : 'Say "Hey Tarang" or click mic';

  } else if (stateName === 'greeting') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-400 animate-pulse border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-blue-950/40 border-blue-500/40`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-blue-300 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = 'Tarang is speaking…';
    if (useBackendTranscription) transcriptEl.textContent = 'Speaking...';

  } else if (stateName === 'listening_mood') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-pulse border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-emerald-950/40 border-emerald-500/45 siri-pulse-active`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-emerald-300 relative z-10 transition-colors duration-300';
    if (bars) bars.classList.remove('hidden');
    statusEl.textContent = isCommandMode ? 'Listening for command...' : 'Listening for mood...';
    if (!tarangMoodBuffer) {
      transcriptEl.textContent = isCommandMode ? 'Speak your command now' : 'Speak your mood now';
    }

  } else if (stateName === 'waiting_for_curate') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-violet-400 animate-pulse border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-purple-950/50 border-purple-500/35`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-violet-300 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = useBackendTranscription ? 'Click mic to say command' : 'Say "Curate my mood"';
    if (useBackendTranscription) {
      transcriptEl.textContent = 'Say "Curate my mood" or other commands';
    }

  } else if (stateName === 'processing') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 animate-ping border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-amber-950/40 border-amber-500/40`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-amber-300 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = 'Processing…';
    transcriptEl.textContent = 'Working on it';

  } else if (stateName === 'idle') {
    dotEl.className = 'absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-500 border-2 border-[#06050b] transition-all duration-300';
    micContainer.className = `${BASE_MIC} bg-purple-950/50 border-purple-500/30`;
    if (micIcon) micIcon.className = 'h-6 w-6 text-purple-300 relative z-10 transition-colors duration-300';
    micContainer.classList.remove('siri-pulse-active');
    statusEl.textContent = 'Ready';
  }
}

// 15. CHIME SOUNDS (Web Audio API)
function playChime(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'error') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(147, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
      osc.start(); osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {}
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 14. VISUALIZER (Canvas frequency ring)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function startVisualizer(stream) {
  const canvas = document.getElementById('tarang-wave-canvas');
  if (!canvas) return;
  const canvasCtx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 64;
  source.connect(analyserNode);

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  canvas.style.opacity = '1';

  function draw() {
    visualizerFrameId = requestAnimationFrame(draw);
    analyserNode.getByteFrequencyData(dataArray);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate average volume for silence detection
    if (useBackendTranscription && isRecording) {
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const averageVolume = sum / bufferLength; // 0 to 255
      
      // Let's log levels occasionally for debugging
      if (Math.random() < 0.05) {
        console.log(`[Tarang Live Audio Level] Volume: ${averageVolume.toFixed(2)} | Speech Detected: ${averageVolume > 12}`);
      }

      if (averageVolume > 12) {
        if (!hasUserSpoken) {
          hasUserSpoken = true;
          console.log("[Tarang Silence Detection] Speech started.");
        }
        lastSpeechTime = Date.now();
      } else {
        const elapsedSinceStart = Date.now() - lastSpeechTime;
        if (!hasUserSpoken) {
          // If the user hasn't spoken at all, auto-stop after 4 seconds of silence
          if (elapsedSinceStart > 4000) {
            console.log("[Tarang Silence Detection] No speech detected for 4s. Auto-stopping.");
            stopRecording();
          }
        } else {
          // If the user has spoken, auto-stop after 1.2 seconds of silence
          if (elapsedSinceStart > 1200) {
            console.log("[Tarang Silence Detection] 1.2s silence detected. Auto-stopping.");
            stopRecording();
          }
        }
      }
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = canvas.width / 2.6;

    canvasCtx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const angle = (i / bufferLength) * Math.PI * 2;
      const val = dataArray[i] / 255;
      const r = baseRadius + val * 10;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.closePath();
    canvasCtx.strokeStyle = 'rgba(168, 85, 247, 0.85)';
    canvasCtx.lineWidth = 3;
    canvasCtx.shadowBlur = 8;
    canvasCtx.shadowColor = 'rgba(168, 85, 247, 0.6)';
    canvasCtx.stroke();
  }
  draw();
}

function stopVisualizer() {
  if (visualizerFrameId) {
    cancelAnimationFrame(visualizerFrameId);
    visualizerFrameId = null;
  }
  const canvas = document.getElementById('tarang-wave-canvas');
  if (canvas) {
    canvas.style.opacity = '0';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 15. LANGUAGE DETECTION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function detectTextLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  return 'en';
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 16. AMBIENT THEME SYNC
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function applyAmbientTheme(moodStr) {
  if (!moodStr) return;
  const mood = moodStr.toLowerCase();
  let theme = 'chill';

  if (['cozy','warm','rain','coffee','night','winter','soothing','morning'].some(k => mood.includes(k))) theme = 'cozy';
  else if (['happy','joy','sun','dance','fun','party','excit','smile'].some(k => mood.includes(k))) theme = 'happy';
  else if (['sad','cry','lonely','heartbreak','blue','grief','heavy','pain'].some(k => mood.includes(k))) theme = 'sad';
  else if (['hype','workout','run','motivat','power','energy','fast','gym'].some(k => mood.includes(k))) theme = 'hype';
  else if (['focus','study','code','work','read','calm','peace'].some(k => mood.includes(k))) theme = 'focus';

  document.body.setAttribute('data-theme', theme);
  writeConsoleLog(`Visual Sync: Ambient theme â†’ "${theme.toUpperCase()}"`, 'info');
}

