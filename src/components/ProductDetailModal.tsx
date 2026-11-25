import { useEffect, useState } from 'react';
import { Ruler, ShoppingBag, X } from 'lucide-react';
import type { LuxuryProduct } from '../data/catalog';
import { formatRub } from '../utils/shopLogic';

interface ProductDetailModalProps {
  product: LuxuryProduct | null;
  onClose: () => void;
  onAddToCart: (productId: string, size: string) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] ?? 'One Size');
      setImgError(false);
      setShowSizeGuide(false);
    }
  }, [product]);

  if (!product) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-6 backdrop-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-[var(--svv-surface)] text-[var(--svv-text)] rounded-t-3xl sm:rounded-3xl border border-[var(--svv-border)] shadow-2xl modal-pop-responsive"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-[var(--svv-border-strong)] rounded-full mx-auto mt-3 mb-1" />

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--svv-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--svv-muted)]">
            <span className="font-bold tracking-wider uppercase text-[var(--svv-text)]">
              {product.brand}
            </span>
            <span aria-hidden="true">†</span>
            <span>{product.origin}</span>
            <span aria-hidden="true">·</span>
            <span>{product.availability}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть карточку товара"
            className="min-h-[40px] min-w-[40px] -mr-1 flex items-center justify-center rounded-full bg-[var(--svv-surface-2)] text-[var(--svv-text)] hover:opacity-80 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 sm:p-6">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-[var(--svv-well)] border border-[var(--svv-border)]">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={`${product.brand} — ${product.name}`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[var(--svv-surface-2)] to-[var(--svv-surface)]">
                <span className="text-xs font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                  {product.brand}
                </span>
                <span className="my-2 font-display italic text-4xl font-black text-[var(--svv-muted)] opacity-35 leading-none">
                  †
                </span>
                <span className="text-base font-semibold text-[var(--svv-text)]">{product.name}</span>
                <span className="mt-1.5 text-xs text-[var(--svv-muted)]">Живые фото у @SVV_manager</span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div>
                <h2
                  id="pdp-title"
                  className="font-display text-2xl font-bold text-[var(--svv-text)] leading-snug"
                >
                  {product.name}
                </h2>
                <p className="mt-2 text-xl font-bold text-[var(--svv-text)] tabular-nums">
                  {formatRub(product.price)}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--svv-border)]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--svv-muted)]">
                  Описание вещи
                </p>
                <p className="mt-1.5 text-sm text-[var(--svv-text-soft)] leading-relaxed">
                  {product.stylistNote}
                </p>
                {product.pairingTip && (
                  <p className="mt-1.5 text-xs text-[var(--svv-muted)] leading-relaxed">
                    Сочетание: {product.pairingTip}
                  </p>
                )}
              </div>

              {product.composition && (
                <div className="pt-3 border-t border-[var(--svv-border)]">
                  <p className="text-xs text-[var(--svv-muted)]">Материал</p>
                  <p className="mt-0.5 text-sm text-[var(--svv-text)]">{product.composition}</p>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--svv-border)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[var(--svv-muted)]">Размер</p>
                  <button
                    type="button"
                    onClick={() => setShowSizeGuide((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-[var(--svv-text)] hover:underline cursor-pointer"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>{showSizeGuide ? 'Скрыть таблицу' : 'Гид по посадке'}</span>
                  </button>
                </div>

                {showSizeGuide && (
                  <div className="mb-3 p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-[11px] text-[var(--svv-text-soft)] space-y-1">
                    <p className="font-semibold text-[var(--svv-text)]">
                      Ориентир SVV по росту и посадке:
                    </p>
                    <p>XS / 44 · рост 160–170 см · S / 46 · рост 170–178 см</p>
                    <p>M / 48 · рост 176–184 см · L / 50 · рост 183–192 см</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => {
                    const active = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-h-[42px] min-w-[48px] px-3.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                            : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)] hover:border-[var(--svv-border-strong)]'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onAddToCart(product.id, selectedSize || product.sizes[0] || 'One Size');
                  onClose();
                }}
                className="w-full min-h-[48px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-sm font-bold hover:bg-[var(--svv-accent-hover)] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Добавить в корзину · {formatRub(product.price)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
