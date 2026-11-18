import './scanner.css';
import type { Product } from '../domain/models';
import { t } from '../i18n';

/** Card of the product found on Open Food Facts. */
export function ProductCard({ product }: { product: Product }) {
  const grade = product.nutriscore?.trim().charAt(0).toLowerCase() ?? '';
  return (
    <div class="product-card">
      {/* The name next to it describes the picture. */}
      {product.imageUrl && (
        <img class="product-card-image" src={product.imageUrl} alt="" width="48" height="48" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <div class="product-card-text">
        <span class="product-card-name">{product.name ?? product.barcode}</span>
        {product.brand && <span class="product-card-brand">{product.brand}</span>}
        {product.nutriscore && (
          <span class="product-nutriscore" data-grade={grade}>{t('nutriscore', [product.nutriscore.toUpperCase()])}</span>
        )}
      </div>
    </div>
  );
}
