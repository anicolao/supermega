export type SoundKind =
  | "select"
  | "mark"
  | "bonus"
  | "ready"
  | "undo"
  | "reveal"
  | "score"
  | "error";
let context: AudioContext | undefined;
let muted = localStorage.getItem("supermega:sound") === "off";
export const soundEnabled = () => !muted;
export function unlockSound() {
  if (muted) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Silent devices still support every game choice.
  }
}
export function toggleSound() {
  muted = !muted;
  localStorage.setItem("supermega:sound", muted ? "off" : "on");
  if (!muted) {
    unlockSound();
    playSound("select");
  }
  return !muted;
}
/** Short, soft synthesized plucks. No samples, autoplay, or sounds from remote replay. */
export function playSound(kind: SoundKind) {
  if (muted) return;
  try {
    unlockSound();
    if (!context) return;
    const notes: Record<SoundKind, number[]> = {
      select: [660],
      mark: [523, 784],
      bonus: [659, 831, 988],
      ready: [784, 1047],
      undo: [659, 523],
      reveal: [392, 587, 784],
      score: [523, 659, 784, 1047],
      error: [294],
    };
    notes[kind].forEach((frequency, index) => {
      const start = context!.currentTime + index * 0.065,
        osc = context!.createOscillator(),
        gain = context!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(
        frequency * 1.015,
        start + 0.12,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(context!.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  } catch {
    /* Audio availability never blocks a game choice. */
  }
}
