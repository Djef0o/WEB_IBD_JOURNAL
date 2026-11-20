import { navigate, type ScreenProps } from '../../router';
import { UrgentCard } from '../emergency/UrgentCard';

/** Closes the card: back where the user came from, or the home screen when the card was opened directly. */
function leave(): void {
  // Entries pushed by the router carry a state object; a page loaded straight on /urgent has none.
  if (history.state !== null && history.length > 1) history.back();
  else void navigate('/', { replace: true });
}

/** Full-screen urgent-need card, reachable from the home screen and the settings (`UrgentNeedCard`). */
export default function Urgent(_props: ScreenProps) {
  return <UrgentCard onClose={leave} />;
}
