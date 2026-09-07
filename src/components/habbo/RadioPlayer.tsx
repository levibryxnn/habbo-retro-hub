import { useEffect, useRef, useState } from "react";
import { PixelButton } from "./PixelButton";
import { HabboAvatar } from "./HabboAvatar";

/** Stream e API de metadados da rádio do fã-site (padrão AzuraCast/Shoutcast). */
const STREAM_URL = "https://stream.zeno.fm/0r0xa792kwzuv";
const METADATA_URL = "";

type RadioStatus = {
  online: boolean;
  dj: string;
  listeners: number | null;
  song: string;
};

const FALLBACK: RadioStatus = {
  online: true,
  dj: "DJ Bobba",
  listeners: 42,
  song: "Habbo Lounge — Pixel Beats",
};

export function RadioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [status, setStatus] = useState<RadioStatus>(FALLBACK);

  useEffect(() => {
    if (!METADATA_URL) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(METADATA_URL);
        if (!response.ok) return;
        const data = (await response.json()) as {
          now_playing?: { song?: { text?: string } };
          live?: { is_live?: boolean; streamer_name?: string };
          listeners?: { current?: number };
        };
        if (!active) return;
        setStatus({
          online: data.live?.is_live ?? true,
          dj: data.live?.streamer_name || "AutoDJ",
          listeners: data.listeners?.current ?? null,
          song: data.now_playing?.song?.text || "—",
        });
      } catch {
        /* mantém o último status conhecido */
      }
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      audio.volume = volume;
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="space-y-3">
      <audio ref={audioRef} src={STREAM_URL} preload="none" />

      <div className="flex items-center gap-2">
        <span
          className={`inline-block size-3 rounded-full border-2 border-border-strong ${
            status.online ? "bg-success" : "bg-destructive"
          }`}
        />
        <span className="font-pixel text-[0.6rem]">{status.online ? "NO AR" : "FORA DO AR"}</span>
        {status.listeners !== null && (
          <span className="ml-auto text-xs text-muted-foreground">
            {status.listeners} ouvintes
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 rounded-sm border-2 border-border-strong bg-muted p-2">
        <HabboAvatar username={status.dj} headOnly size="m" className="h-12 w-auto" />
        <div className="min-w-0">
          <p className="font-pixel text-[0.6rem]">{status.dj}</p>
          <p className="truncate text-xs text-muted-foreground" title={status.song}>
            🎵 {status.song}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <PixelButton variant={playing ? "danger" : "success"} size="sm" onClick={toggle}>
          {playing ? "❚❚ Pausar" : "▶ Play"}
        </PixelButton>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Volume da rádio"
          onChange={(event) => setVolume(Number(event.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-sm border-2 border-border-strong bg-muted accent-secondary"
        />
      </div>
    </div>
  );
}
