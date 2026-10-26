const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY_STORAGE_KEY = "muse.openrouter.apiKey";
const MODEL_STORAGE_KEY = "muse.openrouter.model";
const SAVED_SCORES_STORAGE_KEY = "muse.savedScores";
const NATURAL_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEY_NAMES_BY_PITCH_CLASS = {
  major: ["C major", "Db major", "D major", "Eb major", "E major", "F major", "F# major", "G major", "Ab major", "A major", "Bb major", "B major"],
  minor: ["C minor", "C# minor", "D minor", "Eb minor", "E minor", "F minor", "F# minor", "G minor", "G# minor", "A minor", "Bb minor", "B minor"],
};
const KEY_SIGNATURES = {
  "c major": 0, "a minor": 0, "g major": 1, "e minor": 1, "d major": 2, "b minor": 2,
  "a major": 3, "f# minor": 3, "e major": 4, "c# minor": 4, "b major": 5, "g# minor": 5,
  "f# major": 6, "d# minor": 6, "c# major": 7, "a# minor": 7, "f major": -1, "d minor": -1,
  "bb major": -2, "g minor": -2, "eb major": -3, "c minor": -3, "ab major": -4, "f minor": -4,
  "db major": -5, "bb minor": -5, "gb major": -6, "eb minor": -6, "cb major": -7, "ab minor": -7,
  "gb minor": -9,
};
const PLAYBACK_PROFILES = {
  piano: { waveform: "sine", attack: 0.006, decay: 0.18, sustain: 0.28, release: 0.08, volume: 0.22 },
  "acoustic guitar": { waveform: "triangle", attack: 0.004, decay: 0.12, sustain: 0.12, release: 0.07, volume: 0.2 },
  violin: { waveform: "sawtooth", attack: 0.09, decay: 0.14, sustain: 0.78, release: 0.12, volume: 0.11 },
  cello: { waveform: "sawtooth", attack: 0.13, decay: 0.18, sustain: 0.76, release: 0.14, volume: 0.1 },
  flute: { waveform: "sine", attack: 0.035, decay: 0.08, sustain: 0.82, release: 0.08, volume: 0.15 },
  "soprano recorder": { waveform: "triangle", attack: 0.025, decay: 0.08, sustain: 0.72, release: 0.06, volume: 0.14 },
  clarinet: { waveform: "square", attack: 0.035, decay: 0.09, sustain: 0.72, release: 0.08, volume: 0.1 },
  trumpet: { waveform: "sawtooth", attack: 0.025, decay: 0.08, sustain: 0.75, release: 0.08, volume: 0.085 },
  saxophone: { waveform: "sawtooth", attack: 0.045, decay: 0.13, sustain: 0.7, release: 0.1, volume: 0.09 },
  harp: { waveform: "sine", attack: 0.004, decay: 0.22, sustain: 0.1, release: 0.07, volume: 0.2 },
};

const starterScore = {
  title: "A Window Full of Rain",
  key: "C major",
  tempo: 76,
  timeSignature: "4/4",
  bars: [
    { notes: [{ pitch: "E5", duration: "quarter" }, { pitch: "D5", duration: "quarter" }, { pitch: "C5", duration: "half" }] },
    { notes: [{ pitch: "G4", duration: "quarter" }, { pitch: "C5", duration: "quarter" }, { pitch: "E5", duration: "quarter" }, { pitch: "D5", duration: "quarter" }] },
    { notes: [{ pitch: "C5", duration: "half" }, { pitch: "A4", duration: "quarter" }, { pitch: "G4", duration: "quarter" }] },
    { notes: [{ pitch: "F4", duration: "quarter" }, { pitch: "G4", duration: "quarter" }, { pitch: "C5", duration: "half" }] },
  ],
};

const elements = {
  prompt: document.querySelector("#prompt"),
  characterCount: document.querySelector("#character-count"),
  generateButton: document.querySelector("#generate-button"),
  generateLabel: document.querySelector("#generate-label"),
  status: document.querySelector("#form-status"),
  mood: document.querySelector("#mood"),
  difficulty: document.querySelector("#difficulty"),
  instrument: document.querySelector("#instrument"),
  tempo: document.querySelector("#tempo"),
  playbackInstrument: document.querySelector("#playback-instrument"),
  barCount: document.querySelector("#bar-count"),
  autoLength: document.querySelector("#auto-length"),
  transpose: document.querySelector("#transpose"),
  transposeValue: document.querySelector("#transpose-value"),
  transposeReset: document.querySelector("#transpose-reset"),
  canvas: document.querySelector("#score-canvas"),
  scoreScroll: document.querySelector("#score-scroll"),
  scoreSection: document.querySelector("#score-section"),
  scoreFocusToggle: document.querySelector("#score-focus-toggle"),
  scoreTitle: document.querySelector("#score-title"),
  pieceSubtitle: document.querySelector("#piece-subtitle"),
  scoreStatus: document.querySelector("#score-status"),
  scoreDetails: document.querySelector("#score-details"),
  saveScoreButton: document.querySelector("#save-score-button"),
  savedScores: document.querySelector("#saved-scores"),
  removeScoreButton: document.querySelector("#remove-score-button"),
  savedScoresStatus: document.querySelector("#saved-scores-status"),
  playButton: document.querySelector("#play-button"),
  playLabel: document.querySelector("#play-label"),
  downloadButton: document.querySelector("#download-button"),
  settingsToggle: document.querySelector("#settings-toggle"),
  settingsPanel: document.querySelector("#settings-panel"),
  closeSettings: document.querySelector("#close-settings"),
  saveSettings: document.querySelector("#save-settings"),
  apiKey: document.querySelector("#api-key"),
  model: document.querySelector("#model"),
};

let baseScore = starterScore;
let currentScore = starterScore;
let currentInstrument = "piano";
let currentStatusLabel = "STARTER SCORE";
let transposeSemitones = 0;
let audioContext;
let playbackTimer;
let playbackEndTimer;
let playbackToken = 0;
let activeOscillators = [];
let scoreLayoutRefreshPending = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function readSettings() {
  return {
    apiKey: elements.apiKey.value.trim(),
    model: elements.model.value.trim(),
  };
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", isError);
}

function loadApiKey() {
  try {
    elements.apiKey.value = window.localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch (error) {
    setStatus("Browser storage is unavailable, so the API key cannot be restored. You can still enter it for this session.", true);
  }
}

function loadModelSelection() {
  try {
    const savedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (!savedModel) return;
    if (![...elements.model.options].some((option) => option.value === savedModel)) {
      setStatus("The saved model is no longer available. Choose a model and it will be remembered.", true);
      return;
    }
    elements.model.value = savedModel;
  } catch (error) {
    setStatus("Browser storage is unavailable, so the model selection cannot be restored.", true);
  }
}

function saveModelSelection() {
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, elements.model.value);
  } catch (error) {
    setStatus("Couldn't remember the selected model because browser storage is unavailable.", true);
  }
}

function initializePlaybackInstruments() {
  elements.playbackInstrument.replaceChildren(...[...elements.instrument.options].map((option) => new Option(option.textContent, option.value)));
  elements.playbackInstrument.value = elements.instrument.value;
}

function saveApiKey() {
  try {
    const apiKey = elements.apiKey.value.trim();
    if (apiKey) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      setStatus("API key saved in this browser.", false);
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
      setStatus("Saved API key removed.", false);
    }
    return true;
  } catch (error) {
    setStatus("Couldn't save the API key to browser storage. It can still be used until this page closes.", true);
    return false;
  }
}

function noteDuration(duration) {
  return { whole: 4, half: 2, quarter: 1, eighth: 0.5 }[duration];
}

function keyAccidentals(key) {
  const signature = KEY_SIGNATURES[key.trim().toLowerCase()];
  const accidentals = {};
  const sharpOrder = ["F", "C", "G", "D", "A", "E", "B"];
  const flatOrder = ["B", "E", "A", "D", "G", "C", "F"];
  const order = signature >= 0 ? sharpOrder : flatOrder;
  for (let index = 0; index < Math.abs(signature); index++) {
    accidentals[order[index]] = signature > 0 ? 1 : -1;
  }
  return accidentals;
}

function pitchToMidi(pitch, key) {
  const match = pitch.match(/^([A-G])([#bn]?)([2-6])$/);
  if (!match) return null;
  const explicitAlteration = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  const alteration = match[2] ? explicitAlteration : keyAccidentals(key)[match[1]] || 0;
  return (Number(match[3]) + 1) * 12 + NATURAL_SEMITONES[match[1]] + alteration;
}

function transposeKey(key, semitones) {
  const match = key.match(/^([A-G])([#b]?)\s+(major|minor)$/i);
  if (!match) throw new Error(`Cannot transpose the unsupported key "${key}".`);
  const rootPitchClass = (NATURAL_SEMITONES[match[1].toUpperCase()] + (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) + 12) % 12;
  const targetPitchClass = ((rootPitchClass + semitones) % 12 + 12) % 12;
  return KEY_NAMES_BY_PITCH_CLASS[match[3].toLowerCase()][targetPitchClass];
}

function midiToPitch(midiNote, key) {
  const pitchClass = ((midiNote % 12) + 12) % 12;
  const preferredAccidental = KEY_SIGNATURES[key.toLowerCase()] < 0 ? "b" : "#";
  const candidates = [];
  for (const letter of Object.keys(NATURAL_SEMITONES)) {
    for (const accidental of ["", "#", "b", "n"]) {
      const pitch = `${letter}${accidental}4`;
      if (((pitchToMidi(pitch, key) % 12) + 12) % 12 !== pitchClass) continue;
      const rank = accidental === "" ? 0 : accidental === preferredAccidental ? 1 : accidental === "n" ? 2 : 3;
      candidates.push({ pitch, rank });
    }
  }
  candidates.sort((left, right) => left.rank - right.rank);
  if (!candidates.length) throw new Error("The transposed note cannot be spelled in this key.");
  const candidate = candidates[0].pitch;
  const octave = 4 + (midiNote - pitchToMidi(candidate, key)) / 12;
  if (!Number.isInteger(octave) || octave < 2 || octave > 6) throw new Error("The transposed note is outside the supported staff range.");
  return `${candidate.slice(0, -1)}${octave}`;
}

function transposeScore(score, semitones) {
  if (semitones === 0) return score;
  const key = transposeKey(score.key, semitones);
  return {
    ...score,
    key,
    bars: score.bars.map((bar) => ({
      notes: bar.notes.map((note) => ({
        ...note,
        pitch: note.pitch === "rest" ? "rest" : midiToPitch(pitchToMidi(note.pitch, score.key) + semitones, key),
      })),
    })),
  };
}

function renderCurrentScore() {
  currentScore = transposeScore(baseScore, transposeSemitones);
  elements.transposeValue.textContent = `${transposeSemitones > 0 ? "+" : ""}${transposeSemitones} st`;
  renderScore(currentScore, currentInstrument, currentStatusLabel);
  scoreLayoutRefreshPending = false;
}

function validateScore(score, expectedBars, expectedTempo = null) {
  if (!score || typeof score !== "object") throw new Error("The model response was not a score object.");
  if (typeof score.title !== "string" || !score.title.trim()) throw new Error("The score is missing a title.");
  if (typeof score.key !== "string" || !score.key.trim()) throw new Error("The score is missing a key.");
  if (!Object.hasOwn(KEY_SIGNATURES, score.key.trim().toLowerCase())) {
    throw new Error("The score must use a supported major or minor key.");
  }
  if (!Number.isInteger(score.tempo) || score.tempo < 40 || score.tempo > 200) {
    throw new Error("Tempo must be a whole number between 40 and 200 BPM.");
  }
  if (expectedTempo !== null && score.tempo !== expectedTempo) {
    throw new Error(`The score must use the selected tempo of ${expectedTempo} BPM.`);
  }
  if (score.timeSignature !== "4/4") throw new Error("The score must use 4/4 time.");
  if (!Array.isArray(score.bars) || score.bars.length < 4 || score.bars.length > 100) {
    throw new Error("The score must contain between 4 and 100 bars.");
  }
  if (expectedBars !== null && score.bars.length !== expectedBars) {
    throw new Error(`The score must contain exactly ${expectedBars} bars.`);
  }

  for (const [barIndex, bar] of score.bars.entries()) {
    if (!bar || !Array.isArray(bar.notes) || bar.notes.length === 0) {
      throw new Error(`Bar ${barIndex + 1} is missing its notes.`);
    }
    let beats = 0;
    for (const note of bar.notes) {
      if (!note || typeof note.pitch !== "string" || !/^(?:[A-G](?:#|b|n)?[3-5]|rest)$/.test(note.pitch)) {
        throw new Error(`Bar ${barIndex + 1} contains an invalid pitch.`);
      }
      const duration = noteDuration(note.duration);
      if (!duration) throw new Error(`Bar ${barIndex + 1} contains an unsupported note length.`);
      beats += duration;
    }
    if (beats !== 4) throw new Error(`Bar ${barIndex + 1} must add up to four beats.`);
  }
  return score;
}

function normalizeScore(score) {
  return {
    title: score.title.trim().slice(0, 80),
    key: score.key.trim().slice(0, 30),
    tempo: score.tempo,
    timeSignature: score.timeSignature,
    bars: score.bars.map((bar) => ({
      notes: bar.notes.map((note) => ({ pitch: note.pitch, duration: note.duration })),
    })),
  };
}

function parseModelJson(content) {
  if (typeof content !== "string") throw new Error("The model returned an empty response.");
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("The model response wasn't valid JSON. Try again or choose a different model.");
  }
}

async function generateScore() {
  const { apiKey, model } = readSettings();
  const prompt = elements.prompt.value.trim();
  if (!apiKey) {
    elements.settingsPanel.hidden = false;
    elements.settingsToggle.setAttribute("aria-expanded", "true");
    elements.apiKey.focus();
    setStatus("Add your OpenRouter API key in Settings to generate a new score.", true);
    return;
  }
  if (!model) {
    setStatus("Choose a model in Settings to generate a new score.", true);
    return;
  }
  if (!prompt) {
    elements.prompt.focus();
    setStatus("Add a few words about the music you have in mind.", true);
    return;
  }

  const autoLength = elements.autoLength.checked;
  const requestedBars = autoLength ? null : Number(elements.barCount.value);
  const requestedTempo = elements.tempo.value === "" ? null : Number(elements.tempo.value);
  if (!autoLength && (!Number.isInteger(requestedBars) || requestedBars < 4 || requestedBars > 100)) {
    elements.barCount.focus();
    setStatus("Choose a whole-number length from 4 to 100 bars, or enable Auto.", true);
    return;
  }

  stopPlayback();
  setStatus("");
  elements.generateButton.disabled = true;
  elements.generateLabel.textContent = "Composing…";

  const mood = elements.mood.value;
  const difficulty = elements.difficulty.value;
  const instrument = elements.instrument.value;
  const difficultyGuidance = {
    beginner: "Stay mostly within C4-G4, use stepwise motion, and favor quarter and half notes for an easy-to-follow melody.",
    easy: "Stay mostly within C4-A4, use simple stepwise phrases, and add only occasional eighth notes.",
    intermediate: "Use a balanced range, moderate melodic leaps, and a mix of quarter, half, and occasional eighth notes.",
    advanced: "Explore the full A3-G5 range with wider leaps and varied quarter/eighth-note rhythms.",
    expert: "Use the full A3-G5 range, expressive leaps, and more involved eighth-note figures while developing motifs with nuance.",
  }[difficulty];
  const lengthRequest = autoLength
    ? `Choose a suitable length from 4 to 100 bars for this ${instrument} melody.`
    : `Compose a ${requestedBars}-bar ${instrument} melody.`;
  const systemPrompt = [
    "You compose expressive, coherent musical scores and return only valid JSON, with no markdown or extra text.",
    "Return exactly this shape: {\"title\":\"...\",\"key\":\"C major\",\"tempo\":76,\"timeSignature\":\"4/4\",\"bars\":[{\"notes\":[{\"pitch\":\"C4\",\"duration\":\"quarter\"}]}]}.",
    autoLength
      ? "Choose a suitable score length between 4 and 100 bars based on the musical idea. Every bar is 4/4 and its notes must total exactly 4 beats."
      : `The score must have exactly ${requestedBars} bars. Every bar is 4/4 and its notes must total exactly 4 beats.`,
    "Allowed pitches are A3-G5 with an optional # (sharp), b (flat), or n (natural) marker before the octave, or the exact pitch \"rest\". Unmarked pitches follow the key signature; use n to cancel a key-signature accidental. Allowed durations are whole (4 beats), half (2), quarter (1), eighth (0.5).",
    "Use a singable, coherent melody, mostly quarter and half notes with occasional eighth notes. Avoid filling bars with rests. Set tempo to a whole number from 40 to 200. If a tempo is requested, use that exact BPM. Set timeSignature to \"4/4\".",
    "For longer scores, develop a recurring musical motif with tasteful variation rather than repeating identical bars.",
    mood ? `Give the music a ${mood} mood.` : "Choose a mood that fits the musical idea.",
    `Difficulty: ${difficulty}. ${difficultyGuidance}`,
    requestedTempo === null ? "Choose a fitting tempo for this piece." : `Set the tempo to exactly ${requestedTempo} BPM.`,
    `Write for ${instrument}. Keep the title short. Choose a plausible key name such as \"A minor\" or \"G major\".`,
  ].join(" ");

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Muse Sheet Music",
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: autoLength ? 8192 : Math.min(8192, Math.max(2048, requestedBars * 80)),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${lengthRequest} Tempo: ${requestedTempo === null ? "choose a fitting tempo" : `${requestedTempo} BPM`}. Difficulty: ${difficulty}. ${mood ? `Desired mood: ${mood}.` : "Choose a fitting mood."} Inspiration: ${prompt}` },
        ],
      }),
    });

    if (!response.ok) {
      let detail = "";
      try {
        const errorBody = await response.json();
        detail = errorBody?.error?.message || "";
      } catch {
        detail = "";
      }
      if (response.status === 401) throw new Error("OpenRouter rejected this API key. Check it in Settings.");
      if (response.status === 402) throw new Error("Your OpenRouter account needs available credits to use this model.");
      if (response.status === 429) throw new Error("OpenRouter is rate limiting requests. Wait a moment and try again.");
      throw new Error(detail ? `OpenRouter: ${detail}` : `OpenRouter returned an error (${response.status}).`);
    }

    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content;
    baseScore = normalizeScore(validateScore(parseModelJson(content), requestedBars, requestedTempo));
    currentInstrument = instrument;
    elements.playbackInstrument.value = instrument;
    currentStatusLabel = "AI COMPOSITION";
    renderCurrentScore();
    elements.scoreSection.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    setStatus("");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Couldn't generate a score. Please try again.", true);
  } finally {
    elements.generateButton.disabled = false;
    elements.generateLabel.textContent = "Make me a score";
  }
}

function pitchPosition(pitch) {
  const match = pitch.match(/^([A-G])([#bn]?)([2-6])$/);
  if (!match) return null;
  const diatonicIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }[match[1]];
  return (Number(match[3]) - 4) * 7 + diatonicIndex - 2;
}

function getScoreLayout(availableWidth) {
  const width = Math.max(220, Math.round(availableWidth));
  const compact = width < 440;
  const maxBarStart = compact ? 106 : 175;
  const rightPadding = compact ? 12 : 24;
  const barsPerSystem = Math.max(1, Math.min(4, Math.floor((width - maxBarStart - rightPadding) / 112)));
  return { width, compact, barsPerSystem };
}

function renderScore(score, instrument, statusLabel) {
  const barCount = score.bars.length;
  const { width, compact, barsPerSystem } = getScoreLayout(elements.canvas.clientWidth);
  const systemCount = Math.ceil(barCount / barsPerSystem);
  const systemHeight = 132;
  const height = systemCount * systemHeight + 12;
  const staffTop = 34;
  const lineGap = 10;
  const bottomLine = staffTop + lineGap * 4;
  const systemsSvg = [];
  const signatureCount = Math.abs(KEY_SIGNATURES[score.key.toLowerCase()]);
  const signatureStart = compact ? 40 : 64;
  const signatureSpacing = compact ? 6 : 10;
  const meterX = signatureStart + signatureCount * signatureSpacing + (compact ? 6 : 5);
  const barStart = compact ? Math.max(96, meterX + 18) : Math.max(112, meterX + 36);
  const rightPadding = compact ? 12 : 24;
  const barWidth = (width - barStart - rightPadding) / barsPerSystem;
  const noteInset = compact ? 8 : 12;
  const staffStart = compact ? 34 : 58;
  const signaturePositions = KEY_SIGNATURES[score.key.toLowerCase()] >= 0
    ? [8, 5, 9, 6, 3, 7, 4]
    : [4, 7, 3, 6, 2, 5, 1];
  const keyAlterations = keyAccidentals(score.key);

  for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
    const systemElements = [];
    const firstBar = systemIndex * barsPerSystem;
    const lastBar = Math.min(firstBar + barsPerSystem, barCount);
    for (let line = 0; line < 5; line++) {
      const y = staffTop + line * lineGap;
      systemElements.push(`<line class="staff-line" x1="${staffStart}" y1="${y}" x2="${width - rightPadding}" y2="${y}"/>`);
    }
    systemElements.push(`<text class="music-text" x="${compact ? 3 : 24}" y="${staffTop + 45}" font-size="${compact ? 44 : 65}">𝄞</text>`);
    for (let index = 0; index < signatureCount; index++) {
      const accidental = KEY_SIGNATURES[score.key.toLowerCase()] > 0 ? "♯" : "♭";
      const accidentalY = bottomLine - signaturePositions[index] * (lineGap / 2);
      systemElements.push(`<text class="music-text" x="${signatureStart + index * signatureSpacing}" y="${accidentalY + 5}" font-size="${compact ? 13 : 16}">${accidental}</text>`);
    }
    systemElements.push(`<text class="music-text" x="${meterX}" y="${staffTop + 13}" font-size="${compact ? 16 : 20}">${escapeHtml(score.timeSignature.split("/")[0])}</text>`);
    systemElements.push(`<text class="music-text" x="${meterX}" y="${staffTop + 31}" font-size="${compact ? 16 : 20}">${escapeHtml(score.timeSignature.split("/")[1])}</text>`);
    systemElements.push(`<line class="bar-line" x1="${barStart}" y1="${staffTop}" x2="${barStart}" y2="${bottomLine}"/>`);

    for (let barIndex = firstBar; barIndex < lastBar; barIndex++) {
      const bar = score.bars[barIndex];
      const localBar = barIndex - firstBar;
      const xLeft = barStart + localBar * barWidth;
      const xRight = xLeft + barWidth;
      systemElements.push(`<text class="music-small" x="${xLeft + 4}" y="${staffTop - 12}">${barIndex + 1}</text>`);
      let elapsedEighths = 0;
      bar.notes.forEach((note) => {
        const duration = noteDuration(note.duration);
        const x = xLeft + noteInset + ((elapsedEighths + duration) / 8) * (barWidth - noteInset * 2);
        elapsedEighths += duration * 2;
        const position = note.pitch === "rest" ? null : pitchPosition(note.pitch);
        const y = position === null ? staffTop + lineGap * 2 : bottomLine - position * (lineGap / 2);
        const noteX = Math.min(x, xRight - 8);
        if (note.pitch === "rest") {
          const restMark = note.duration === "half" || note.duration === "whole" ? "𝄼" : note.duration === "eighth" ? "𝄾" : "𝄽";
          systemElements.push(`<text class="music-text" x="${noteX - 5}" y="${y + 6}" font-size="22">${restMark}</text>`);
          return;
        }
        const pitchParts = note.pitch.match(/^([A-G])([#bn]?)[2-6]$/);
        const writtenAlteration = pitchParts[2] === "#" ? 1 : pitchParts[2] === "b" ? -1 : 0;
        const keyAlteration = keyAlterations[pitchParts[1]] || 0;
        const showAccidental = pitchParts[2] !== "" && writtenAlteration !== keyAlteration;
        const accidental = showAccidental
          ? pitchParts[2] === "#" ? "♯" : pitchParts[2] === "b" ? "♭" : "♮"
          : "";
        if (accidental) systemElements.push(`<text class="music-text" x="${noteX - 12}" y="${y + 4}" font-size="${compact ? 12 : 14}">${accidental}</text>`);
        for (let ledgerPosition = 6; ledgerPosition <= position; ledgerPosition += 2) {
          const ledgerY = bottomLine - ledgerPosition * (lineGap / 2);
          systemElements.push(`<line class="ledger-line" x1="${noteX - 7}" y1="${ledgerY}" x2="${noteX + 7}" y2="${ledgerY}"/>`);
        }
        for (let ledgerPosition = -2; ledgerPosition >= position; ledgerPosition -= 2) {
          const ledgerY = bottomLine - ledgerPosition * (lineGap / 2);
          systemElements.push(`<line class="ledger-line" x1="${noteX - 7}" y1="${ledgerY}" x2="${noteX + 7}" y2="${ledgerY}"/>`);
        }
        const filled = note.duration !== "whole" && note.duration !== "half";
        systemElements.push(`<ellipse class="note-head" cx="${noteX}" cy="${y}" rx="${compact ? 4.6 : 5.4}" ry="${compact ? 3.4 : 3.8}" transform="rotate(-18 ${noteX} ${y})" fill="${filled ? "#25251f" : "#f5f2e9"}" ${filled ? "" : 'stroke-width="1.5"'}/>`);
        if (note.duration !== "whole") {
          const stemDown = position >= 4;
          const stemX = stemDown ? noteX - 5 : noteX + 5;
          const stemY2 = y + (stemDown ? 31 : -31);
          systemElements.push(`<line class="note-stem" x1="${stemX}" y1="${y + (stemDown ? 1 : -1)}" x2="${stemX}" y2="${stemY2}"/>`);
          if (note.duration === "eighth") {
            const flagDirection = stemDown ? -1 : 1;
            const flagVerticalDirection = stemDown ? -1 : 1;
            systemElements.push(`<path class="note-flag" d="M${stemX} ${stemY2} q${flagDirection * 10} ${flagVerticalDirection * 5} ${flagDirection * 5} ${flagVerticalDirection * 12}"/>`);
          }
        }
      });
      systemElements.push(`<line class="bar-line" x1="${xRight}" y1="${staffTop}" x2="${xRight}" y2="${bottomLine}"/>`);
    }
    systemElements.push(`<line class="playhead" data-system-index="${systemIndex}" x1="${barStart}" y1="${staffTop - 7}" x2="${barStart}" y2="${bottomLine + 8}"/>`);
    systemsSvg.push(`<g class="score-system" data-system-index="${systemIndex}" transform="translate(0 ${systemIndex * systemHeight})">${systemElements.join("")}</g>`);
  }

  elements.canvas.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(score.title)}, treble clef, ${barCount} bars in ${escapeHtml(score.timeSignature)}"><style>.staff-line{stroke:#4c4b44;stroke-width:1}.bar-line{stroke:#494840;stroke-width:1.25}.note-head{stroke:#25251f}.note-stem,.ledger-line,.beam{stroke:#25251f;stroke-width:1.5;stroke-linecap:square}.note-flag{fill:none;stroke:#25251f;stroke-width:1.6;stroke-linecap:round}.music-text{fill:#282820;font-family:'Times New Roman',serif}.music-small{fill:#535148;font-family:monospace;font-size:9px}.playhead{stroke:#a78bfa;stroke-width:2;opacity:0}.playhead.active{opacity:.8}</style>${systemsSvg.join("")}</svg>`;
  elements.canvas.dataset.width = String(width);
  elements.canvas.dataset.height = String(height);
  elements.canvas.dataset.barsPerSystem = String(barsPerSystem);
  elements.canvas.dataset.compactLayout = String(compact);
  elements.canvas.dataset.barStart = String(barStart);
  elements.canvas.dataset.barWidth = String(barWidth);
  elements.canvas.dataset.systemCount = String(systemCount);
  elements.canvas.dataset.staffTop = String(staffTop);
  elements.canvas.dataset.bottomLine = String(bottomLine);

  elements.scoreTitle.textContent = score.title;
  elements.pieceSubtitle.innerHTML = `${escapeHtml(instrument[0].toUpperCase() + instrument.slice(1))} sketch <span aria-hidden="true">·</span> ready to play`;
  elements.scoreStatus.textContent = statusLabel;
  elements.scoreDetails.innerHTML = `${escapeHtml(score.key)} <span aria-hidden="true">·</span> ${escapeHtml(score.timeSignature)} <span aria-hidden="true">·</span> ${score.tempo} BPM <span aria-hidden="true">·</span> ${score.bars.length} bars`;
}

function setSavedScoresStatus(message, isError = false) {
  elements.savedScoresStatus.textContent = message;
  elements.savedScoresStatus.classList.toggle("is-error", isError);
}

function readSavedScores() {
  try {
    const stored = window.localStorage.getItem(SAVED_SCORES_STORAGE_KEY);
    if (!stored) return [];
    const scores = JSON.parse(stored);
    if (!Array.isArray(scores)) throw new Error("The saved-score library is not a list.");
    for (const saved of scores) {
      if (!saved || typeof saved.id !== "string" || typeof saved.instrument !== "string" || !Number.isInteger(saved.transpose) || saved.transpose < -12 || saved.transpose > 12) {
        throw new Error("A saved score has invalid metadata.");
      }
      validateScore(saved.score, null);
      if (typeof saved.savedAt !== "string") throw new Error("A saved score is missing its saved date.");
    }
    return scores;
  } catch (error) {
    setSavedScoresStatus(`Unable to read saved scores: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    return null;
  }
}

function refreshSavedScores() {
  const scores = readSavedScores();
  if (!scores) {
    return false;
  }
  elements.savedScores.replaceChildren(new Option("Saved scores", ""));
  for (const saved of scores) {
    const option = new Option(`${saved.title || saved.score.title} · ${new Date(saved.savedAt).toLocaleDateString()}`, saved.id);
    elements.savedScores.add(option);
  }
  setSavedScoresStatus(scores.length ? `${scores.length} saved score${scores.length === 1 ? "" : "s"}` : "No saved scores yet.", false);
  return true;
}

function saveCurrentScore() {
  const scores = readSavedScores();
  if (!scores) return;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  scores.unshift({
    id,
    title: baseScore.title,
    score: baseScore,
    instrument: currentInstrument,
    playbackInstrument: elements.playbackInstrument.value,
    transpose: transposeSemitones,
    savedAt: new Date().toISOString(),
  });
  try {
    window.localStorage.setItem(SAVED_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch (error) {
    setSavedScoresStatus(`Couldn't save this score: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    return;
  }
  if (refreshSavedScores()) {
    elements.savedScores.value = id;
    elements.removeScoreButton.disabled = false;
    setSavedScoresStatus(`Saved "${baseScore.title}".`, false);
  }
}

function removeSelectedScore() {
  const scores = readSavedScores();
  if (!scores) return;
  const selectedId = elements.savedScores.value;
  const saved = scores.find((score) => score.id === selectedId);
  if (!saved) {
    setSavedScoresStatus("Choose a saved score to remove.", true);
    return;
  }
  const title = saved.title || saved.score.title;
  if (!window.confirm(`Remove "${title}" from saved scores? This cannot be undone.`)) return;
  try {
    const remainingScores = scores.filter((score) => score.id !== selectedId);
    window.localStorage.setItem(SAVED_SCORES_STORAGE_KEY, JSON.stringify(remainingScores));
  } catch (error) {
    setSavedScoresStatus(`Couldn't remove this score: ${error instanceof Error ? error.message : "browser storage is unavailable."}`, true);
    return;
  }
  elements.savedScores.value = "";
  elements.removeScoreButton.disabled = true;
  if (refreshSavedScores()) setSavedScoresStatus(`Removed "${title}".`, false);
}

function loadSelectedScore() {
  const scores = readSavedScores();
  if (!scores) return;
  const saved = scores.find((score) => score.id === elements.savedScores.value);
  if (!saved) {
    setSavedScoresStatus("Choose a saved score to load.", true);
    return;
  }
  try {
    if (![...elements.instrument.options].some((option) => option.value === saved.instrument)) {
      throw new Error("This score uses an instrument that is no longer available.");
    }
    const playbackInstrument = saved.playbackInstrument || saved.instrument;
    if (![...elements.playbackInstrument.options].some((option) => option.value === playbackInstrument)) {
      throw new Error("This score uses a playback instrument that is no longer available.");
    }
    baseScore = normalizeScore(validateScore(saved.score, null));
    currentInstrument = saved.instrument;
    currentStatusLabel = "SAVED SCORE";
    transposeSemitones = saved.transpose;
    elements.instrument.value = currentInstrument;
    elements.playbackInstrument.value = playbackInstrument;
    elements.transpose.value = String(transposeSemitones);
    stopPlayback();
    renderCurrentScore();
    setSavedScoresStatus(`Loaded "${baseScore.title}".`, false);
  } catch (error) {
    setSavedScoresStatus(`Couldn't load this score: ${error instanceof Error ? error.message : "the saved score is invalid."}`, true);
  }
}

function stopPlayback() {
  playbackToken++;
  window.clearInterval(playbackTimer);
  window.clearTimeout(playbackEndTimer);
  playbackTimer = undefined;
  playbackEndTimer = undefined;
  activeOscillators.forEach((oscillator) => oscillator.stop());
  activeOscillators = [];
  elements.playButton.classList.remove("is-playing");
  elements.playLabel.textContent = "Play";
  elements.canvas.querySelector("svg")?.classList.remove("is-playing");
  const start = Number(elements.canvas.dataset.barStart);
  elements.canvas.querySelectorAll(".playhead").forEach((playhead) => {
    playhead.classList.remove("active");
    playhead.setAttribute("x1", String(start));
    playhead.setAttribute("x2", String(start));
  });
  if (scoreLayoutRefreshPending) renderCurrentScore();
}

async function playScore() {
  if (elements.playButton.classList.contains("is-playing")) {
    stopPlayback();
    return;
  }
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    setStatus("Audio playback is not supported in this browser.", true);
    return;
  }
  try {
    audioContext ||= new AudioContextConstructor();
    await audioContext.resume();
  } catch {
    setStatus("Couldn't start audio. Check your browser's audio permissions and try again.", true);
    return;
  }

  const token = ++playbackToken;
  const svg = elements.canvas.querySelector("svg");
  const playheads = [...elements.canvas.querySelectorAll(".playhead")];
  const barStart = Number(elements.canvas.dataset.barStart);
  const barWidth = Number(elements.canvas.dataset.barWidth);
  const barsPerSystem = Number(elements.canvas.dataset.barsPerSystem);
  const notes = currentScore.bars.flatMap((bar) => bar.notes);
  const secondsPerBeat = 60 / currentScore.tempo;
  const totalDuration = notes.reduce((sum, note) => sum + noteDuration(note.duration) * secondsPerBeat, 0);
  const playbackProfile = PLAYBACK_PROFILES[elements.playbackInstrument.value] || PLAYBACK_PROFILES.piano;
  const scrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  let lastScrolledSystem = -1;
  let elapsed = 0;

  elements.scoreSection.scrollIntoView({ behavior: scrollBehavior, block: "start" });
  elements.playButton.classList.add("is-playing");
  elements.playLabel.textContent = "Stop";
  svg.classList.add("is-playing");
  playheads[0]?.classList.add("active");

  for (const note of notes) {
    if (token !== playbackToken) return;
    const duration = noteDuration(note.duration) * secondsPerBeat;
    if (note.pitch !== "rest") {
      const midiNote = pitchToMidi(note.pitch, currentScore.key);
      if (midiNote !== null) {
        const frequency = 440 * (2 ** ((midiNote - 69) / 12));
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const startTime = audioContext.currentTime + elapsed;
        const attackTime = Math.min(playbackProfile.attack, duration * 0.35);
        const releaseTime = Math.min(playbackProfile.release, duration * 0.35);
        const peakGain = playbackProfile.volume;
        const releaseStart = startTime + Math.max(attackTime, duration - releaseTime);
        oscillator.type = playbackProfile.waveform;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(peakGain, startTime + attackTime);
        const decayEnd = Math.min(releaseStart, startTime + attackTime + playbackProfile.decay);
        if (decayEnd > startTime + attackTime) {
          gain.gain.exponentialRampToValueAtTime(peakGain * playbackProfile.sustain, decayEnd);
          if (releaseStart > decayEnd) gain.gain.setValueAtTime(peakGain * playbackProfile.sustain, releaseStart);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
        activeOscillators.push(oscillator);
      }
    }
    elapsed += duration;
  }

  const startedAt = performance.now();
  playbackTimer = window.setInterval(() => {
    if (token !== playbackToken) return;
    const progress = Math.min(1, (performance.now() - startedAt) / (totalDuration * 1000));
    const barPosition = Math.min(currentScore.bars.length - 1, progress * currentScore.bars.length);
    const systemIndex = Math.floor(barPosition / barsPerSystem);
    if (systemIndex !== lastScrolledSystem) {
      playheads[systemIndex]?.closest(".score-system")?.scrollIntoView({ behavior: scrollBehavior, block: "center" });
      lastScrolledSystem = systemIndex;
    }
    const localBarPosition = barPosition - systemIndex * barsPerSystem;
    const x = barStart + localBarPosition * barWidth;
    playheads.forEach((playhead, index) => {
      const active = index === systemIndex;
      playhead.classList.toggle("active", active);
      if (active) {
        playhead.setAttribute("x1", String(x));
        playhead.setAttribute("x2", String(x));
      }
    });
  }, 32);
  playbackEndTimer = window.setTimeout(() => {
    if (token === playbackToken) stopPlayback();
  }, totalDuration * 1000 + 80);
}

function downloadScore() {
  const svg = elements.canvas.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", elements.canvas.dataset.width);
  clone.setAttribute("height", elements.canvas.dataset.height);
  clone.querySelectorAll(".playhead").forEach((playhead) => playhead.remove());
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${currentScore.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "muse-score"}.svg`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

elements.prompt.addEventListener("input", () => {
  elements.characterCount.textContent = `${elements.prompt.value.length} / 500`;
});

elements.autoLength.addEventListener("change", () => {
  const isAutomatic = elements.autoLength.checked;
  elements.barCount.disabled = isAutomatic;
});

elements.generateButton.addEventListener("click", generateScore);
elements.model.addEventListener("change", saveModelSelection);
elements.playButton.addEventListener("click", playScore);
elements.downloadButton.addEventListener("click", downloadScore);
elements.transpose.addEventListener("input", () => {
  const nextTranspose = Number(elements.transpose.value);
  if (!Number.isInteger(nextTranspose) || nextTranspose < -12 || nextTranspose > 12) {
    setStatus("Transpose must be a whole number from -12 to +12 semitones.", true);
    return;
  }
  stopPlayback();
  transposeSemitones = nextTranspose;
  renderCurrentScore();
});
elements.transposeReset.addEventListener("click", () => {
  elements.transpose.value = "0";
  stopPlayback();
  transposeSemitones = 0;
  renderCurrentScore();
});
elements.saveScoreButton.addEventListener("click", saveCurrentScore);
elements.removeScoreButton.addEventListener("click", removeSelectedScore);
elements.savedScores.addEventListener("change", () => {
  elements.removeScoreButton.disabled = elements.savedScores.value === "";
  if (elements.savedScores.value) loadSelectedScore();
});
function setScoreFocusMode(isFocused) {
  document.body.classList.toggle("score-focus-mode", isFocused);
  elements.scoreFocusToggle.setAttribute("aria-pressed", String(isFocused));
  const label = isFocused ? "Close focused score" : "Show score only";
  elements.scoreFocusToggle.querySelector("span").textContent = isFocused ? "Close" : "Focus score";
  elements.scoreFocusToggle.setAttribute("aria-label", label);
  elements.scoreFocusToggle.setAttribute("title", label);
}
elements.scoreFocusToggle.addEventListener("click", () => {
  setScoreFocusMode(!document.body.classList.contains("score-focus-mode"));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("score-focus-mode")) {
    setScoreFocusMode(false);
    elements.scoreFocusToggle.focus();
  }
});
elements.settingsToggle.addEventListener("click", () => {
  const opening = elements.settingsPanel.hidden;
  elements.settingsPanel.hidden = !opening;
  elements.settingsToggle.setAttribute("aria-expanded", String(opening));
  if (opening) elements.apiKey.focus();
});
elements.closeSettings.addEventListener("click", () => {
  elements.settingsPanel.hidden = true;
  elements.settingsToggle.setAttribute("aria-expanded", "false");
  elements.settingsToggle.focus();
});
elements.saveSettings.addEventListener("click", () => {
  if (!saveApiKey()) return;
  elements.settingsPanel.hidden = true;
  elements.settingsToggle.setAttribute("aria-expanded", "false");
  elements.settingsToggle.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.settingsPanel.hidden) {
    elements.settingsPanel.hidden = true;
    elements.settingsToggle.setAttribute("aria-expanded", "false");
    elements.settingsToggle.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && document.activeElement === elements.prompt) {
    generateScore();
  }
});

const scoreLayoutObserver = new ResizeObserver(() => {
  const layout = getScoreLayout(elements.canvas.clientWidth);
  const compactLayout = elements.canvas.dataset.compactLayout === "true";
  if (layout.barsPerSystem === Number(elements.canvas.dataset.barsPerSystem) && layout.compact === compactLayout) return;
  if (elements.playButton.classList.contains("is-playing")) {
    scoreLayoutRefreshPending = true;
    return;
  }
  renderCurrentScore();
});
scoreLayoutObserver.observe(elements.scoreScroll);

document.querySelector("#current-year").textContent = String(new Date().getFullYear());
loadApiKey();
loadModelSelection();
initializePlaybackInstruments();
elements.transpose.value = "0";
renderCurrentScore();
refreshSavedScores();
