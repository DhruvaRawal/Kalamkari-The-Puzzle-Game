/** A coin amount: icon + number + (visually hidden) unit, never colour-only. */
export function Coin({ amount, label = 'coins', large }: { amount: number; label?: string; large?: boolean }) {
  return (
    <span class={`coin${large ? ' coin--large' : ''}`}>
      <img class="coin-icon" src="/assets/coin.png" alt="" aria-hidden="true" draggable={false} />
      <span class="coin-amount">{amount}</span>
      <span class="sr-only"> {label}</span>
    </span>
  );
}
