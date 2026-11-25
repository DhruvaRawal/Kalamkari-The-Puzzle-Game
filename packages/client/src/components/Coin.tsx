/** A coin amount: icon + number + (visually hidden) unit, never colour-only. */
export function Coin({ amount, label = 'coins', large }: { amount: number; label?: string; large?: boolean }) {
  return (
    <span class={`coin${large ? ' coin--large' : ''}`}>
      <svg viewBox="0 0 20 20" width="1em" height="1em" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="var(--turmeric)" stroke="var(--on-accent)" stroke-width="1.2" />
        <circle cx="10" cy="10" r="5" fill="none" stroke="var(--on-accent)" stroke-width="1" />
        <rect x="8.5" y="8.5" width="3" height="3" fill="var(--on-accent)" />
      </svg>
      <span class="coin-amount">{amount}</span>
      <span class="sr-only"> {label}</span>
    </span>
  );
}
