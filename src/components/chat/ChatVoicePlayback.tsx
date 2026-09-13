import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  formatPlaybackSpeedLabel,
  getNextPlaybackSpeed,
} from '@/services/audio/helpers';
import type { AudioPlayerHandle } from '@/components/ui/AudioPlayer';

interface ChatVoicePlaybackContextValue {
  speed: number;
  setSpeed: (rate: number) => void;
  cycleSpeed: () => void;
  isPlaying: boolean;
  claimPlay: (id: string, handle: AudioPlayerHandle) => void;
  notifyStopped: (id: string) => void;
  registerHandle: (id: string, handle: AudioPlayerHandle | null) => void;
}

const ChatVoicePlaybackContext = createContext<ChatVoicePlaybackContextValue | null>(null);

function speedStorageKey(conversationId: string) {
  return `chatVoiceSpeed:${conversationId}`;
}

function loadSpeed(conversationId: string): number {
  try {
    const raw = sessionStorage.getItem(speedStorageKey(conversationId));
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

export function ChatVoicePlaybackProvider({
  conversationId,
  children,
}: {
  conversationId: string;
  children: ReactNode;
}) {
  const [speed, setSpeedState] = useState(() => loadSpeed(conversationId));
  const [isPlaying, setIsPlaying] = useState(false);
  const handlesRef = useRef(new Map<string, AudioPlayerHandle>());
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSpeedState(loadSpeed(conversationId));
    setIsPlaying(false);
    activeIdRef.current = null;
  }, [conversationId]);

  const setSpeed = useCallback(
    (rate: number) => {
      setSpeedState(rate);
      try {
        sessionStorage.setItem(speedStorageKey(conversationId), String(rate));
      } catch {
        /* ignore */
      }
      const active = activeIdRef.current;
      if (active) {
        const el = handlesRef.current.get(active)?.getElement();
        if (el) el.playbackRate = rate;
      }
    },
    [conversationId],
  );

  const cycleSpeed = useCallback(() => {
    setSpeed(getNextPlaybackSpeed(speed));
  }, [setSpeed, speed]);

  const registerHandle = useCallback((id: string, handle: AudioPlayerHandle | null) => {
    if (handle) handlesRef.current.set(id, handle);
    else handlesRef.current.delete(id);
  }, []);

  const claimPlay = useCallback((id: string, handle: AudioPlayerHandle) => {
    for (const [otherId, other] of handlesRef.current) {
      if (otherId !== id) other.pause();
    }
    handlesRef.current.set(id, handle);
    const el = handle.getElement();
    if (el) el.playbackRate = speed;
    activeIdRef.current = id;
    setIsPlaying(true);
  }, [speed]);

  const notifyStopped = useCallback((id: string) => {
    if (activeIdRef.current !== id) return;
    activeIdRef.current = null;
    setIsPlaying(false);
  }, []);

  const value = useMemo(
    () => ({
      speed,
      setSpeed,
      cycleSpeed,
      isPlaying,
      claimPlay,
      notifyStopped,
      registerHandle,
    }),
    [speed, setSpeed, cycleSpeed, isPlaying, claimPlay, notifyStopped, registerHandle],
  );

  return (
    <ChatVoicePlaybackContext.Provider value={value}>{children}</ChatVoicePlaybackContext.Provider>
  );
}

export function useChatVoicePlayback() {
  return useContext(ChatVoicePlaybackContext);
}

export function ChatVoiceSpeedBar() {
  const ctx = useChatVoicePlayback();
  if (!ctx?.isPlaying) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-center border-b border-border-subtle bg-surface-elevated/95 px-3 py-1.5 backdrop-blur-sm motion-safe:animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={ctx.cycleSpeed}
        className="min-h-9 rounded-pill border border-border-subtle bg-surface px-3 text-caption font-semibold text-text-primary transition-colors hover:border-brand/40 hover:text-brand focus-ring"
        aria-label={`Скорость воспроизведения ${formatPlaybackSpeedLabel(ctx.speed)}`}
      >
        {formatPlaybackSpeedLabel(ctx.speed)}
      </button>
    </div>
  );
}
