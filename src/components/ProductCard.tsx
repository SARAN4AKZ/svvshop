import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { LuxuryProduct } from '../data/catalog';
import { formatRub } from '../utils/shopLogic';

interface ProductCardProps {
  product: LuxuryProduct;
  onOpenDetail: (product: LuxuryProduct) => void;
  onQuickAdd: (product: LuxuryProduct) => void;
  compact?: boolean;
}

export function ProductCard({
  product,
  onOpenDetail,
  onQuickAdd,
  compact = false,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[var(--svv-well)] border border-[var(--svv-border)] transition-transform duration-300 group-hover:-translate-y-0.5">
        <button
          type="button"
          onClick={() => onOpenDetail(product)}
          aria-label={`Открыть ${product.brand} ${product.name}`}
          className="block w-full h-full cursor-pointer text-left"
        >
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={`${product.brand} — ${product.name}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[var(--svv-surface-2)] to-[var(--svv-surface)]">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                {product.brand}
              </span>
              <span className="my-1.5 font-display italic text-2xl font-black text-[var(--svv-muted)] opacity-40 leading-none">
                †
              </span>
              <span className="text-[11px] font-medium text-[var(--svv-text-soft)] line-clamp-2 max-w-[90%]">
                {product.category}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />
        </button>

        {/* Price overlay inside bottom scrim + quick add */}
        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 pointer-events-none">
          <span className="text-sm sm:text-base font-bold text-[#ffffff] tabular-nums drop-shadow-sm">
            {formatRub(product.price)}
          </span>
          {!compact && (
            <button
              type="button"
              onClick={() => onQuickAdd(product)}
              aria-label={`Добавить в корзину: ${product.name}`}
              className="pointer-events-auto min-h-[34px] min-w-[34px] px-2.5 rounded-full bg-[#ffffff] text-[#111111] text-xs font-semibold hover:bg-[#eae7df] press-spring inline-flex items-center justify-center gap-1 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">В корзину</span>
            </button>
          )}
        </div>
      </div>

      {/* Minimalist caption under portrait card */}
      <button
        type="button"
        onClick={() => onOpenDetail(product)}
        className="mt-2.5 text-left cursor-pointer"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--svv-muted)] truncate">
          {product.brand}
        </p>
        <h3 className="mt-0.5 text-xs sm:text-sm font-medium text-[var(--svv-text)] leading-snug line-clamp-2">
          {product.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-[var(--svv-muted)] truncate">
          Размеры: {product.sizes.join(', ')}
        </p>
      </button>
    </article>
  );
}
