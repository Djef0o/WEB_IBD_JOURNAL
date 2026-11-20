import './meal.css';
import '../forms/forms.css';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { deleteMeal, getMeal, saveMeal } from '../../db/meals';
import { deletePhoto, getPhoto, importPhoto } from '../../db/photos';
import { MEAL_TYPES, meal as newMeal, type Meal, type MealType, type Product } from '../../domain/models';
import type { LocalDate } from '../../domain/time';
import { t } from '../../i18n';
import { BarcodeScanDialog } from '../../scanner/BarcodeScanDialog';
import { Button, SegmentedControl, Sheet, showToast } from '../components';
import { fullDate } from '../screens/history/labels';
import { canSaveMeal, planPhoto } from './mealDraft';
import { resizeImage } from './imageResize';

export const MEAL_LABEL_KEYS: Record<MealType, string> = {
  BREAKFAST: 'meal_breakfast',
  LUNCH: 'meal_lunch',
  DINNER: 'meal_dinner',
};

export interface MealEditorSheetProps {
  open: boolean;
  date: LocalDate;
  /** Type proposé pour un nouveau repas (ignoré en édition). */
  mealType: MealType;
  /** Repas à modifier ; absent : nouveau repas. */
  mealId?: number;
  onClose(): void;
}

/** Feuille d'ajout / modification d'un repas (`MealEditorSheet.kt`). */
export function MealEditorSheet({ open, date, mealType, mealId, onClose }: MealEditorSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={mealId === undefined ? t('add_meal') : t('edit_meal')} closeLabel={t('close')}>
      <MealForm date={date} mealType={mealType} mealId={mealId} onClose={onClose} />
    </Sheet>
  );
}

const ORIGIN_OPTIONS = MEAL_TYPES.map((value) => ({ value, key: MEAL_LABEL_KEYS[value] }));

function MealForm({ date, mealType, mealId, onClose }: Omit<MealEditorSheetProps, 'open'>) {
  // `undefined` : chargement du repas édité.
  const [loaded, setLoaded] = useState<Meal | null | undefined>(mealId === undefined ? null : undefined);
  useEffect(() => {
    if (mealId === undefined) return;
    let alive = true;
    void getMeal(mealId).then((m) => alive && setLoaded(m));
    return () => {
      alive = false;
    };
  }, [mealId]);

  if (loaded === undefined) return <p class="text-muted">{t('web_loading')}</p>;
  return <MealFields date={date} initialType={mealType} editing={loaded} onClose={onClose} />;
}

function MealFields({ date, initialType, editing, onClose }: { date: LocalDate; initialType: MealType; editing: Meal | null; onClose(): void }) {
  const descId = useId();
  const [type, setType] = useState<MealType>(editing?.type ?? initialType);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [product, setProduct] = useState<Product | null>(editing?.product ?? null);
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoState, setPhotoState] = useState<'idle' | 'processing' | 'error'>('idle');
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingPhoto = editing?.photoUri ?? null;
  const shownBlob = useShownPhoto(newPhoto, removePhoto ? null : existingPhoto);

  const draft = { description, existingPhoto, hasNewPhoto: newPhoto !== null, removePhoto, product };
  const showsPhoto = newPhoto !== null || (!removePhoto && existingPhoto !== null);

  async function onPick(file: File | undefined): Promise<void> {
    if (!file) return;
    setPhotoState('processing');
    try {
      setNewPhoto(await resizeImage(file));
      setRemovePhoto(false);
      setPhotoState('idle');
    } catch {
      setPhotoState('error');
    }
  }

  async function save(): Promise<void> {
    if (saving || !canSaveMeal(draft)) return;
    setSaving(true);
    try {
      const plan = planPhoto(draft);
      const photoUri = plan.importNew && newPhoto ? await importPhoto(newPhoto) : plan.keepPath;
      await saveMeal({
        ...(editing ?? newMeal({ date, type, description })),
        date: editing?.date ?? date,
        type,
        description,
        photoUri,
        product,
      });
      if (plan.deletePath) await deletePhoto(plan.deletePath);
      onClose();
    } catch {
      setSaving(false);
      showToast(t('scan_error'));
    }
  }

  async function remove(): Promise<void> {
    if (!editing || saving) return;
    setSaving(true);
    await deleteMeal(editing.id);
    showToast(t('web_entry_deleted'));
    onClose();
  }

  return (
    <>
    <form
      class="meal-form stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p class="text-muted">{fullDate(editing?.date ?? date)}</p>

      <SegmentedControl
        label={t('meals_label')}
        options={ORIGIN_OPTIONS.map((o) => ({ value: o.value, label: t(o.key) }))}
        value={type}
        onChange={setType}
      />

      <div class="field">
        <label class="field-name" for={descId}>{t('meal_description_hint')}</label>
        <textarea id={descId} class="input meal-description" rows={3} value={description} onInput={(e) => setDescription(e.currentTarget.value)} />
      </div>

      <div class="stack-sm">
        {showsPhoto && (
          <div class="meal-photo-row">
            {shownBlob.url ? (
              <img class="meal-photo" src={shownBlob.url} alt={t('photo')} />
            ) : (
              <span class="meal-photo meal-photo-missing text-muted text-sm">{shownBlob.loading ? t('web_loading') : t('photo')}</span>
            )}
            <Button
              variant="text"
              onClick={() => {
                setNewPhoto(null);
                setRemovePhoto(true);
              }}
            >
              {t('remove_photo')}
            </Button>
          </div>
        )}
        {!showsPhoto && (
          <div class="row-wrap">
            <PhotoButton label={t('add_photo')} onFile={onPick} />
            <PhotoButton label={t('web_take_photo')} onFile={onPick} capture touchOnly />
          </div>
        )}
        <p class="text-sm" role="status">
          {photoState === 'processing' ? t('web_loading') : photoState === 'error' ? t('web_photo_error') : ''}
        </p>
      </div>

      <Button variant="outlined" onClick={() => setScanOpen(true)}>{t('scan_barcode')}</Button>
      {product && <ProductCard product={product} onRemove={() => setProduct(null)} />}

      <div class="row-wrap meal-actions">
        {editing && (
          <Button variant="outlined" onClick={() => void remove()} disabled={saving}>{t('delete')}</Button>
        )}
        <Button type="submit" disabled={saving || photoState === 'processing' || !canSaveMeal(draft)}>{t('save')}</Button>
      </div>
    </form>
    <BarcodeScanDialog open={scanOpen} onResult={(picked) => { setScanOpen(false); setProduct(picked); }} onClose={() => setScanOpen(false)} />
    </>
  );
}

/** Aperçu de la photo : nouveau Blob, sinon photo stockée ; l'URL d'objet est révoquée au démontage. */
function useShownPhoto(newPhoto: Blob | null, existingPath: string | null): { url: string | null; loading: boolean } {
  const [state, setState] = useState<{ url: string | null; loading: boolean }>({ url: null, loading: false });
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    const show = (blob: Blob | null) => {
      if (!alive) return;
      url = blob ? URL.createObjectURL(blob) : null;
      setState({ url, loading: false });
    };
    if (newPhoto) show(newPhoto);
    else if (existingPath) {
      setState({ url: null, loading: true });
      void getPhoto(existingPath).then(show, () => show(null));
    } else setState({ url: null, loading: false });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [newPhoto, existingPath]);
  return state;
}

function PhotoButton({ label, onFile, capture = false, touchOnly = false }: { label: string; onFile(file: File | undefined): void; capture?: boolean; touchOnly?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="outlined" class={touchOnly ? 'meal-touch-only' : undefined} onClick={() => input.current?.click()}>{label}</Button>
      <input
        ref={input}
        class="visually-hidden"
        type="file"
        accept="image/*"
        capture={capture ? 'environment' : undefined}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
    </>
  );
}

function ProductCard({ product, onRemove }: { product: Product; onRemove(): void }) {
  return (
    <div class="meal-product">
      {product.imageUrl ? (
        <img class="meal-product-img" src={product.imageUrl} alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer" />
      ) : (
        <span class="meal-product-img" aria-hidden="true" />
      )}
      <div class="meal-product-text">
        <strong>{product.name ?? product.barcode}</strong>
        {product.brand && <span class="text-muted text-sm">{product.brand}</span>}
        {product.nutriscore && (
          <span class="text-sm meal-nutri product-nutriscore" data-grade={product.nutriscore.trim().charAt(0).toLowerCase()}>
            {t('nutriscore', [product.nutriscore.toUpperCase()])}
          </span>
        )}
      </div>
      <button type="button" class="icon-btn" aria-label={t('remove_product')} onClick={onRemove}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}
