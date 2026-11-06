import { useCallback, useEffect, useRef, useState } from "react";

function recognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function speechSupported() {
  return Boolean(recognitionCtor()) && typeof window.speechSynthesis !== "undefined";
}

export function recognitionSupported() {
  return Boolean(recognitionCtor());
}

export function useSpeechRecognition() {
  const [supported] = useState(() => recognitionSupported());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAt = useRef<number | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback((onText: (text: string, isFinal: boolean) => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Live speech recognition is not available in this browser. Type your argument instead.");
      return;
    }
    setError(null);
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    let confirmed = "";
    recognition.onresult = (event) => {
      let interim = "";
      let final = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          confirmed = `${confirmed} ${piece}`.trim();
          final = true;
        } else {
          interim += piece;
        }
      }
      onText(`${confirmed} ${interim}`.trim(), final);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone permission was denied. You can continue in text mode.");
      } else if (event.error !== "aborted") {
        setError("Speech recognition stopped. Your typed or captured text is still available.");
      }
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    startedAt.current = Date.now();
    recognition.start();
    setListening(true);
  }, []);

  const elapsedSeconds = useCallback(() => {
    if (!startedAt.current) return null;
    return Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, error, start, stop, elapsedSeconds, setError };
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window.speechSynthesis === "undefined") {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window.speechSynthesis === "undefined") return;
  window.speechSynthesis.cancel();
}
