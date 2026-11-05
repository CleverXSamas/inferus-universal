import { useEffect, useState, useSyncExternalStore } from 'react';
const soundKey = 'inferus-dice-sound';
const soundEvent = 'inferus-dice-sound-change';
let rememberedSound = true;
function soundEnabled() {
  try {
    const saved = localStorage.getItem(soundKey);
    return saved === null ? rememberedSound : saved !== 'off';
  } catch {
    return rememberedSound;
  }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === soundKey || event.key === null) listener();
  };
  window.addEventListener(soundEvent, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(soundEvent, listener);
    window.removeEventListener('storage', storage);
  };
}
export function useDiceSound() {
  const enabled = useSyncExternalStore(subscribe, soundEnabled, () => true);
  const toggle = () => {
    rememberedSound = !soundEnabled();
    try {
      localStorage.setItem(soundKey, rememberedSound ? 'on' : 'off');
    } catch {}
    window.dispatchEvent(new Event(soundEvent));
  };
  return [enabled, toggle] as const;
}
let audio: AudioContext | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
export function playDiceSound(enabled: boolean, success = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const Constructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Constructor) return;
    if (!audio || audio.state === 'closed') audio = new Constructor();
    const context = audio!;
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const now = context.currentTime;
    (success ? [220, 330, 440] : [180, 140]).forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, now + index * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.055 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + 0.14);
      oscillator.start(now + index * 0.055);
      oscillator.stop(now + index * 0.055 + 0.16);
    });
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (context.state === 'running') void context.suspend().catch(() => {});
    }, 800);
  } catch {
    /* Audio availability must never prevent a dice result. */
  }
}
export function useRollAnimation(id?: string, enabled = true) {
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (!id || !enabled) {
      setAnimating(false);
      return;
    }
    setAnimating(true);
    const timer = setTimeout(() => setAnimating(false), 720);
    return () => clearTimeout(timer);
  }, [id, enabled]);
  return animating;
}
