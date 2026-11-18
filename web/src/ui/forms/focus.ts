/**
 * Après une validation refusée : focus sur le premier champ invalide, dont le navigateur annonce alors
 * l'erreur. Différé d'un tick pour laisser le rendu poser `aria-invalid`.
 */
export function focusFirstInvalid(form: HTMLFormElement): void {
  setTimeout(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
}
