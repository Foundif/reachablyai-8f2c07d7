import alertAsset from '@/assets/notification-alert.mp3.asset.json';

let audio: HTMLAudioElement | null = null;
let unlocked = false;

const get = () => {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio(alertAsset.url);
    audio.preload = 'auto';
    audio.volume = 0.9;
  }
  return audio;
};

// Browsers require a user gesture before audio can play. Call once from any click.
export const unlockSound = () => {
  if (unlocked) return;
  const a = get();
  if (!a) return;
  a.play().then(() => { a.pause(); a.currentTime = 0; unlocked = true; }).catch(() => {});
};

export const playAlert = () => {
  const a = get();
  if (!a) return;
  try {
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
};

if (typeof window !== 'undefined') {
  const handler = () => { unlockSound(); window.removeEventListener('click', handler); window.removeEventListener('keydown', handler); };
  window.addEventListener('click', handler);
  window.addEventListener('keydown', handler);
}
