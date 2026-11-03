import alertAsset from "@/assets/notification-alert.mp3";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

const getAudio = (): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(alertAsset);
    audio.preload = "auto";
    audio.volume = 1.0;
  }
  return audio;
};

// Browsers require a user interaction before audio can play
export const unlockSound = () => {
  if (unlocked) return;
  const a = getAudio();
  if (!a) return;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {});
};

// Global click/touch listener to unlock sound on first interaction
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

export const playAlert = () => {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch((err) => {
      console.warn("Notification audio play prevented by browser:", err);
    });
  } catch {}
};
