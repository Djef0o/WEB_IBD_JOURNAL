// Page de démo, servie uniquement par `vite` (http://localhost:5173/dev-components.html).
// Non listée dans rollupOptions.input : absente du build de production.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import '../../styles/reset.css';
import '../../styles/tokens.css';
import '../../styles/palettes.css';
import '../../styles/contrast.css';
import '../../styles/layout.css';
import {
  BristolIcon, BristolPicker, Button, Card, EmptyState, Scale0to5, SegmentedControl, Sheet, Dialog, Switch, ToastHost, showToast,
} from '../components';
import { THEME_MODES, THEME_PALETTES, initTheme, themeMode, themePalette, setThemeMode, setThemePalette } from '../theme';
import type { ThemeMode, ThemePalette } from '../theme';

initTheme();

const MODE_LABEL: Record<ThemeMode, string> = { SYSTEM: 'Système', LIGHT: 'Clair', DARK: 'Sombre', AMOLED: 'AMOLED' };
const PALETTE_LABEL: Record<ThemePalette, string> = {
  SAGE: 'Sauge', SOLARIZED: 'Solarized', NORD: 'Nord', GRUVBOX: 'Gruvbox', CATPPUCCIN: 'Catppuccin', ROSE_PINE: 'Rosé Pine',
};
const NAV = ['Accueil', 'Historique', 'Tendances', 'Soins', 'Réglages'];
const BRISTOL_LABEL = ['Aucune selle dure', 'Noix dures', 'Saucisse grumeleuse', 'Saucisse craquelée', 'Saucisse lisse', 'Morceaux mous', 'Selles pâteuses', 'Liquide'];

function Demo() {
  const [bristol, setBristol] = useState<number | null>(4);
  const [pain, setPain] = useState<number | null>(2);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState('30');
  const [sheet, setSheet] = useState(false);
  const [center, setCenter] = useState(false);
  const mode = themeMode.value;
  const palette = themePalette.value;

  return (
    <div class="app-shell">
      <nav class="app-nav" aria-label="Navigation principale">
        <ul>
          {NAV.map((n, i) => (
            <li key={n}>
              <a href="#" aria-current={i === 0 ? 'page' : undefined} onClick={(e) => e.preventDefault()}>
                <span class="nav-icon" aria-hidden="true">●</span>
                {n}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main class="app-main stack">
        <h1>Design system</h1>

        <Card title="Apparence" variant="outlined">
          <SegmentedControl label="Mode" hideLabel={false} value={mode} options={THEME_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} onChange={setThemeMode} />
          <SegmentedControl label="Palette" hideLabel={false} value={palette} options={THEME_PALETTES.map((p) => ({ value: p, label: PALETTE_LABEL[p] }))} onChange={setThemePalette} />
        </Card>

        <Card title="Boutons">
          <div class="row-wrap">
            <Button>Principal</Button>
            <Button variant="tonal">Tonal</Button>
            <Button variant="outlined">Contour</Button>
            <Button variant="text">Texte</Button>
            <Button variant="danger">Supprimer</Button>
            <Button disabled>Désactivé</Button>
            <Button href="#top" variant="outlined">Lien</Button>
          </div>
        </Card>

        <Card title="Échelle 0–5">
          <Scale0to5 label="Douleur" value={pain} onChange={setPain} minLabel="Aucune" maxLabel="Maximale" />
        </Card>

        <Card title="Bristol">
          <BristolPicker label="Type de selle" value={bristol} onChange={setBristol} typeLabel={(t) => `Type ${t} : ${BRISTOL_LABEL[t]}`} />
          <div class="row-wrap">
            {[0, 1, 3, 5, 7].map((t) => <BristolIcon key={t} type={t} label={`Type ${t}`} size={t === 3 ? 'lg' : t === 5 ? 'sm' : 'md'} />)}
          </div>
        </Card>

        <Card title="Interrupteur et segments">
          <Switch label="Rappel du soir" description="Affiche une carte à l'ouverture" checked={on} onChange={setOn} />
          <Switch label="Désactivé" checked={false} onChange={() => {}} disabled />
          <SegmentedControl label="Période" hideLabel={false} value={seg} onChange={setSeg} options={[{ value: '30', label: '30 jours' }, { value: '90', label: '90 jours' }, { value: 'all', label: 'Tout' }]} />
        </Card>

        <Card title="Feuilles et toasts">
          <div class="row-wrap">
            <Button onClick={() => setSheet(true)}>Ouvrir la feuille</Button>
            <Button variant="outlined" onClick={() => setCenter(true)}>Dialogue centré</Button>
            <Button variant="tonal" onClick={() => showToast('Selle enregistrée')}>Toast</Button>
            <Button variant="tonal" onClick={() => showToast('Repas supprimé', { actionLabel: 'Annuler', onAction: () => showToast('Annulé') })}>Toast + action</Button>
          </div>
        </Card>

        <Card title="État vide">
          <EmptyState title="Aucune selle enregistrée" description="Touchez le bouton ci-dessous pour ajouter la première.">
            <Button>Ajouter</Button>
          </EmptyState>
        </Card>
      </main>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Nouvelle selle" closeLabel="Fermer">
        <div class="stack">
          <BristolPicker label="Type" value={bristol} onChange={setBristol} typeLabel={(t) => `Type ${t}`} />
          <Scale0to5 label="Fatigue" value={pain} onChange={setPain} />
          <form method="dialog" class="row-wrap">
            <Button type="submit" value="save">Enregistrer</Button>
            <Button type="submit" variant="text" value="cancel">Annuler</Button>
          </form>
          <p class="text-muted">Longueur de contenu pour tester le défilement interne.</p>
          {Array.from({ length: 12 }, (_, i) => <p key={i} class="text-muted">Ligne {i + 1}</p>)}
        </div>
      </Sheet>
      <Dialog open={center} variant="center" onClose={() => setCenter(false)} title="Supprimer ?" closeLabel="Fermer">
        <form method="dialog" class="row-wrap">
          <Button type="submit" variant="outlined" value="cancel" autofocus>Garder</Button>
          <Button type="submit" variant="danger" value="delete">Supprimer</Button>
        </form>
      </Dialog>
      <ToastHost label="Notifications" closeLabel="Fermer" />
    </div>
  );
}

render(<Demo />, document.getElementById('app')!);
