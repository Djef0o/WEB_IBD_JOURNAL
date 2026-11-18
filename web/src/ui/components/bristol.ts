/** Couleurs de l'échelle de Bristol, identiques à BristolColors.kt (`bristolColor`). */
export const BRISTOL_TYPES = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type BristolType = (typeof BRISTOL_TYPES)[number];

export function bristolColor(type: number): string {
  if (type === 0) return '#D32F2F';
  if (type === 1 || type === 2) return '#8D6E63';
  if (type === 3 || type === 4) return '#43A047';
  return '#EF6C00';
}

export function bristolIconUrl(type: number): string {
  return `${import.meta.env.BASE_URL}icons/bristol/ic_bristol_${type}.svg`;
}
