# muse.

A small, dependency-free sheet music studio. Describe an idea and mood, generate a score with OpenRouter, play it in the browser, and download the notation as SVG.

## Run locally

Open `index.html` in a modern browser, or serve this folder with any static web server. The starter score and playback work without an API key.

## Generate music

1. Choose **Settings** and enter an [OpenRouter API key](https://openrouter.ai/keys).
2. Choose one of the ten popular OpenRouter models from the model dropdown.
3. Describe an idea, choose a mood, one of five difficulty levels, and one of ten instruments (including Soprano Recorder), enter a length from 4 to 100 bars or enable **Auto**, then select **Make me a score**.

The key is saved in this browser's `localStorage` when you select **Save key**, restored the next time the app opens, and sent only to OpenRouter when a score is requested. `localStorage` is not encrypted and is accessible to scripts running on the same origin, so use this only on a trusted device. Clear the key in Settings and select **Save key** to remove it. Requests go directly from the browser to OpenRouter, so a public deployment should put the API call behind a server-side endpoint rather than expose a shared key.

Generated scores use a constrained JSON format: treble-clef pitches, supported major/minor key signatures, 4/4 bars, and whole, half, quarter, or eighth notes/rests. The app validates each bar before displaying it.

The score is displayed first in a full-height workspace. Choose a tempo in the prompt controls or leave **Any tempo** selected for the model to choose. Use the transpose control beside the notation to change the score by up to an octave in either direction; the notation and playback update together. Choose a playback instrument beside **Play** to change the synthesized sound, and playback follows the active score system as it plays. **Save score** stores the original score, playback instrument, and transpose setting in this browser; selecting a saved score loads it automatically, and **Remove** deletes the selected saved score after confirmation. Saved scores use `localStorage`, are not encrypted, and remain local to this browser. The selected OpenRouter model is also remembered in this browser. Use **Fullscreen** for an immersive view; longer scores wrap into four-bar systems. Very long compositions require more model output and may take longer to generate.
