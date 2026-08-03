import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

const BARS = [6, 10, 14, 9, 16, 12, 18, 8, 13, 17, 10, 15, 7, 12, 16, 9, 14, 11, 17, 8, 13, 15, 10, 6];

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** WhatsApp-style voice note bubble: round play button, waveform, duration. */
export default function VoiceNote({ src, outbound }: { src: string; outbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => { setPlaying(false); setTime(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const progress = duration ? time / duration : 0;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[220px] py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button" onClick={toggle}
        className={cn(
          'h-9 w-9 rounded-full grid place-items-center shrink-0 transition-colors',
          outbound ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30' : 'bg-muted hover:bg-muted/70',
        )}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-[1px]" />}
      </button>

      <div className="flex-1">
        <div className="flex items-end gap-[2px] h-6 cursor-pointer" onClick={seek}>
          {BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                'flex-1 rounded-full transition-opacity',
                outbound ? 'bg-primary-foreground' : 'bg-foreground',
                i / BARS.length <= progress ? 'opacity-90' : 'opacity-30',
              )}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-70 mt-0.5 tabular-nums">
          <Mic className="w-2.5 h-2.5" />
          {fmt(playing || time ? time : duration)}
        </div>
      </div>
    </div>
  );
}
