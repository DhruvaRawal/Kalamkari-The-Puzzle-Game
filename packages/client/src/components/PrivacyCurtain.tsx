import { useEffect, useRef } from 'preact/hooks';

/** Opaque "pass the device" screen shown between hotseat turns. */
export function PrivacyCurtain({ name, onReveal }: { name: string; onReveal: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus(), [name]);
  return (
    <div class="curtain" role="dialog" aria-modal="true" aria-labelledby="curtain-title">
      <div class="curtain-inner">
        <div class="motif-ring" aria-hidden="true" />
        <h2 id="curtain-title">Pass the device to {name}</h2>
        <p>Everyone else, look away. Your design and pieces are secret.</p>
        <button ref={btn} class="btn btn--primary btn--large" onClick={onReveal}>
          I'm {name}. Show my board
        </button>
      </div>
    </div>
  );
}
