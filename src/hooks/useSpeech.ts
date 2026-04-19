// hooks/useSpeech.ts
import { useCallback, useMemo, useRef, useState } from "react";

export type SpeechLang = "ar-SA" | "ar-TN" | "en-US" | "fr-FR" | string;

export interface SpeechSegment {
  text: string;
  lang?: SpeechLang;
}

export interface SpeechController {
  supported: boolean;
  ready: boolean;
  speaking: boolean;
  paused: boolean;
  currentIndex: number;
  voiceUri: string | null;
  voices: SpeechSynthesisVoice[];
  rate: number;
  pitch: number;
  lang: SpeechLang;
  setLang: (lang: SpeechLang) => void;
  setVoiceUri: (uri: string | null) => void;
  setRate: (rate: number) => void;
  setPitch: (rate: number) => void;
  speak: (segments: SpeechSegment[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const isBrowser = typeof window !== "undefined";

export function useSpeech(defaultLang: SpeechLang = "en-US"): SpeechController {
  const supported = isBrowser && "speechSynthesis" in window;
  const [ready] = useState(true);
  const [voices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [lang, setLangState] = useState<SpeechLang>(defaultLang);
  const [rate, setRateState] = useState(1);
  const [pitch, setPitchState] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const segmentsRef = useRef<SpeechSegment[]>([]);
  const currentIndexRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStoppedRef = useRef(false);

  const resetState = useCallback(() => {
    setSpeaking(false);
    setPaused(false);
    setCurrentIndex(-1);
    currentIndexRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    if (!supported) return;
    isStoppedRef.current = true;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    resetState();
  }, [resetState, supported]);

  const speakNextSegment = useCallback(() => {
    if (!supported) return;
    if (isStoppedRef.current) {
      resetState();
      return;
    }

    const segments = segmentsRef.current;
    const index = currentIndexRef.current;

    if (index >= segments.length) {
      resetState();
      return;
    }

    const segment = segments[index];
    const segmentText = segment?.text;
    
    if (!segmentText || typeof segmentText !== "string" || !segmentText.trim()) {
      currentIndexRef.current++;
      speakNextSegment();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(segmentText);
    utterance.lang = segment.lang || lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (isStoppedRef.current) return;
      setSpeaking(true);
      setPaused(false);
      setCurrentIndex(index);
    };

    utterance.onend = () => {
      if (isStoppedRef.current) return;
      currentIndexRef.current++;
      utteranceRef.current = null;
      speakNextSegment();
    };

    utterance.onerror = () => {
      if (isStoppedRef.current) return;
      currentIndexRef.current++;
      utteranceRef.current = null;
      speakNextSegment();
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [supported, lang, rate, pitch, resetState]);

  const speak = useCallback(
    (segments: SpeechSegment[]) => {
      if (!supported) return;

      const validSegments = segments.filter((s) => {
        return s && typeof s.text === "string" && s.text.trim().length > 0;
      });
      
      if (!validSegments.length) return;

      try {
        window.speechSynthesis.cancel();
      } catch {}

      isStoppedRef.current = false;
      segmentsRef.current = validSegments;
      currentIndexRef.current = 0;
      
      speakNextSegment();
    },
    [speakNextSegment, supported],
  );

  const pause = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.pause();
      setPaused(true);
    } catch {}
  }, [supported]);

  const resume = useCallback(() => {
    if (!supported) return;
    try {
      window.speechSynthesis.resume();
      setPaused(false);
      setSpeaking(true);
    } catch {}
  }, [supported]);

  const setLang = useCallback((newLang: SpeechLang) => {
    setLangState(newLang);
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(newRate);
  }, []);

  const setPitch = useCallback((newPitch: number) => {
    setPitchState(newPitch);
  }, []);

  return useMemo(
    () => ({
      supported,
      ready,
      speaking,
      paused,
      currentIndex,
      voiceUri,
      voices,
      rate,
      pitch,
      lang,
      setLang,
      setVoiceUri,
      setRate,
      setPitch,
      speak,
      pause,
      resume,
      stop,
    }),
    [
      currentIndex,
      lang,
      pause,
      paused,
      pitch,
      rate,
      ready,
      resume,
      setLang,
      setRate,
      setPitch,
      speak,
      speaking,
      stop,
      supported,
      voiceUri,
      voices,
    ],
  );
}