import type { Product } from '../../domain/models';

/** Brouillon du repas en cours d'édition (`MealEditorState`). */
export interface MealDraft {
  description: string;
  /** Photo déjà enregistrée sur le repas édité (chemin dans `db/photos`). */
  existingPhoto: string | null;
  /** Photo choisie, déjà réduite, pas encore enregistrée. */
  hasNewPhoto: boolean;
  removePhoto: boolean;
  product: Product | null;
}

/** Enregistrement possible : description, photo ou produit (`MealEditorContent.enabled`). */
export function canSaveMeal(d: MealDraft): boolean {
  return d.description.trim() !== '' || d.hasNewPhoto || d.product !== null || (!d.removePhoto && d.existingPhoto !== null);
}

export interface PhotoPlan {
  /** Importer la nouvelle photo. */
  importNew: boolean;
  /** Chemin de l'ancienne photo à supprimer une fois le repas enregistré. */
  deletePath: string | null;
  /** La photo conservée si aucune nouvelle n'est importée. */
  keepPath: string | null;
}

/** Que faire de la photo à l'enregistrement (`CalendarViewModel.saveMeal`). */
export function planPhoto(d: Pick<MealDraft, 'existingPhoto' | 'hasNewPhoto' | 'removePhoto'>): PhotoPlan {
  const keepPath = d.hasNewPhoto || d.removePhoto ? null : d.existingPhoto;
  return { importNew: d.hasNewPhoto, keepPath, deletePath: d.existingPhoto !== null && d.existingPhoto !== keepPath ? d.existingPhoto : null };
}
