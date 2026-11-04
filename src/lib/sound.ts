import alertAsset from "@/assets/notification-alert.mp3";

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let lastPlayedAt = 0;
const playedKeys = new Set<string>();

const getAudio = (): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(alertAsset);
    audio.preload = "auto";
    audio.volume = 1.0;
  }
  return audio;
};

// Browsers need one user interaction before audio can play.
// Unlock silently (muted) so clicks/opening a chat never make a sound.
export const unlockSound = () => {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
    })
    .catch(() => {
      a.muted = false;
    });
};

if (typeof window !== "undefined") {
  const handler = () => {
    unlockSound();
    window.removeEventListener("click", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("click", handler);
  window.addEventListener("keydown", handler);
  window.addEventListener("touchstart", handler);
}

/**
 * Play the alert once. `key` (e.g. a message id) prevents the same event
 * from ringing twice; a short throttle stops bursts from stacking.
 */
export const playAlert = (key?: string) => {
  if (key) {
    if (playedKeys.has(key)) return;
    playedKeys.add(key);
    if (playedKeys.size > 500) playedKeys.clear();
  }
  const now = Date.now();
  if (now - lastPlayedAt < 1500) return;
  lastPlayedAt = now;
  const a = getAudio();
  if (!a) return;
  try {
    a.muted = false;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
};
