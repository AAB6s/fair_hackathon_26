// components/AccessibilityHub.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import { useSpeech, type SpeechLang } from "../hooks/useSpeech";
import type { SystemState } from "../types";
import { buildDashboardSummary } from "../utils/summary";

interface AccessibilityHubProps {
  state: SystemState;
  isMuted?: boolean;
}

const LOOP_STORAGE_KEY = "aegis-a11y-loop";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 2v5h-5" />
      <path d="M7 22v-5h5" />
      <path d="M20 11a8 8 0 0 0-13.7-5.7L4 7" />
      <path d="M4 13a8 8 0 0 0 13.7 5.7L20 17" />
    </svg>
  );
}

function readStoredLoop(): boolean {
  try {
    return localStorage.getItem(LOOP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AccessibilityHub({ state, isMuted = false }: AccessibilityHubProps) {
  const { locale, t, bcp47 } = useLocale();
  const speech = useSpeech(bcp47 as SpeechLang);

  const manualStopRef = useRef(false);
  const wasSpeakingRef = useRef(false);
  const [loopEnabled, setLoopEnabled] = useState<boolean>(() => readStoredLoop());

  const segments = useMemo(() => buildDashboardSummary(state), [state]);
  
  const speechSegments = useMemo(
    () => {
      return segments.map((s) => {
        let textValue = "";
        
        console.log("🔍 Segment raw:", s);
        
        if (typeof s === "string") {
          textValue = s;
        } else if (s.text) {
          if (typeof s.text === "string") {
            textValue = s.text;
          } else if (typeof s.text === "object") {
            textValue = s.text[locale] || s.text.en || Object.values(s.text)[0] || "";
          } else {
            textValue = String(s.text);
          }
        } else if (s.localizedText) {
          textValue = s.localizedText;
        } else {
          textValue = t(s.id || s.key || "") || JSON.stringify(s);
        }
        
        console.log("📝 Extracted text:", textValue);
        return { text: textValue, lang: bcp47 as SpeechLang };
      }).filter(s => s.text && s.text.length > 0);
    },
    [segments, bcp47, locale, t],
  );

  const runPlayback = useCallback(() => {
    console.log("🎵 Play clicked");
    console.log("📝 Speech segments:", speechSegments);
    
    const fullText = speechSegments.map(s => s.text).join(". ");
    console.log("📖 Full text:", fullText);
    
    if (!speechSegments.length) {
      console.warn("⚠️ No speech segments to read!");
      return;
    }
    if (isMuted) {
      console.log("🔇 Muted - no audio will play");
      return;
    }
    
    manualStopRef.current = false;
    speech.stop();
    speech.speak(speechSegments);
    console.log("🔊 Speaking started");
  }, [speech, speechSegments, isMuted]);

  const handlePauseResume = useCallback(() => {
    console.log("⏯️ Pause/Resume clicked. Current state:", { speaking: speech.speaking, paused: speech.paused });
    manualStopRef.current = false;
    if (speech.paused) {
      speech.resume();
      console.log("▶️ Resumed");
    } else if (speech.speaking) {
      speech.pause();
      console.log("⏸️ Paused");
    }
  }, [speech]);

  const handleStop = useCallback(() => {
    console.log("⏹️ Stop clicked");
    manualStopRef.current = true;
    speech.stop();
  }, [speech]);

  const handleToggleLoop = useCallback(() => {
    setLoopEnabled((prev) => {
      const next = !prev;
      console.log("🔄 Loop toggled:", next);
      try {
        localStorage.setItem(LOOP_STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    console.log("🌐 Language changed to:", bcp47);
    if (speech.lang !== bcp47) {
      speech.setLang(bcp47 as SpeechLang);
    }
  }, [bcp47, speech]);

  useEffect(() => {
    const finished = wasSpeakingRef.current && !speech.speaking && !speech.paused;
    wasSpeakingRef.current = speech.speaking;
    
    if (!finished || !loopEnabled || manualStopRef.current || isMuted) return;
    
    console.log("🔄 Loop triggered - replaying");
    const timer = setTimeout(() => runPlayback(), 500);
    return () => clearTimeout(timer);
  }, [loopEnabled, runPlayback, speech.paused, speech.speaking, isMuted]);

  console.log("🎮 Render - Speech state:", { speaking: speech.speaking, paused: speech.paused, supported: speech.supported });

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={runPlayback}
        disabled={!speech.supported || isMuted}
        className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
        title="Play"
      >
        <PlayIcon />
      </button>
      
      <button
        onClick={handlePauseResume}
        disabled={(!speech.speaking && !speech.paused) || isMuted}
        className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
        title={speech.paused ? "Resume" : "Pause"}
      >
        {speech.paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      
      <button
        onClick={handleStop}
        className="p-2 rounded-full hover:bg-white/10 transition"
        title="Stop"
      >
        <StopIcon />
      </button>
      
      <button
        onClick={handleToggleLoop}
        className={`p-2 rounded-full transition ${
          loopEnabled ? "text-orange-400 bg-orange-400/10" : "hover:bg-white/10"
        }`}
        title={loopEnabled ? "Loop ON" : "Loop OFF"}
      >
        <LoopIcon />
      </button>
    </div>
  );
}