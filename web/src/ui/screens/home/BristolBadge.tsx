import { BristolIcon } from '../../components';

/** Pastille Bristol d'une ligne du fil. */
export function BristolBadge({ type }: { type: number }) {
  return (
    <span class="feed-icon">
      <BristolIcon type={type} size="sm" />
    </span>
  );
}
