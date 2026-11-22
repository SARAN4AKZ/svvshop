import { useState, type FormEvent } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import type { PromoCodeItem } from '../data/catalog';
import { formatRub, normalizePromoCode, validatePromoCodeInput } from '../utils/shopLogic';

interface AdminPromoManagerProps {
  promos: PromoCodeItem[];
  onCreatePromo: (promo: PromoCodeItem) => Promise<void>;
  onTogglePromo: (code: string, nextActive: boolean) => Promise<void>;
  onDeletePromo: (code: string) => Promise<void>;
}

export function AdminPromoManager({
  promos,
  onCreatePromo,
  onTogglePromo,
  onDeletePromo,
}: AdminPromoManagerProps) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValueRaw, setDiscountValueRaw] = useState('15');
  const [minSubtotalRaw, setMinSubtotalRaw] = useState('0');
  const [label, setLabel] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = normalizePromoCode(code);
    const discountValue = Number(discountValueRaw.replace(/\s+/g, ''));
    const minSubtotal = Number(minSubtotalRaw.replace(/\s+/g, '') || '0');

    const validationErrors = validatePromoCodeInput({
      code: cleanCode,
      discountType,
      discountValue,
      minSubtotal,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      const autoLabel =
        discountType === 'percent'
          ? `Скидка ${Math.round(discountValue)}% по коду ${cleanCode}`
          : `Бонус ${formatRub(discountValue)} по коду ${cleanCode}`;
      await onCreatePromo({
        code: cleanCode,
        discountType,
        discountValue: Math.round(discountValue),
        minSubtotal: Math.max(0, Math.round(minSubtotal)),
        label: label.trim() || autoLabel,
        active: true,
      });
      setCode('');
      setLabel('');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Не удалось создать промокод.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-4"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--svv-accent)]" />
          <h2 className="text-sm font-bold text-[var(--svv-text)]">Создать промокод</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="promo-new-code" className="block text-xs text-[var(--svv-muted)] mb-1">
              Код промокода (латиница / цифры)
            </label>
            <input
              id="promo-new-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ARCHIV15"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm font-mono uppercase text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <span className="block text-xs text-[var(--svv-muted)] mb-1">Тип скидки</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold cursor-pointer press-spring ${
                  discountType === 'percent'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                Процент (%)
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold cursor-pointer press-spring ${
                  discountType === 'fixed'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                Сумма (₽)
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label htmlFor="promo-new-value" className="block text-xs text-[var(--svv-muted)] mb-1">
              {discountType === 'percent' ? 'Размер скидки (%)' : 'Размер скидки (₽)'}
            </label>
            <input
              id="promo-new-value"
              type="number"
              min={1}
              value={discountValueRaw}
              onChange={(e) => setDiscountValueRaw(e.target.value)}
              placeholder={discountType === 'percent' ? '15' : '3000'}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="promo-new-min" className="block text-xs text-[var(--svv-muted)] mb-1">
              Мин. сумма заказа (₽)
            </label>
            <input
              id="promo-new-min"
              type="number"
              min={0}
              value={minSubtotalRaw}
              onChange={(e) => setMinSubtotalRaw(e.target.value)}
              placeholder="0"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="promo-new-label" className="block text-xs text-[var(--svv-muted)] mb-1">
              Описание в корзине
            </label>
            <input
              id="promo-new-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Скидка закрытого дропа"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
        </div>

        {errors.length > 0 && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-[var(--svv-danger-bg)] border border-[var(--svv-danger-border)] text-xs text-[var(--svv-danger-fg)] space-y-1"
          >
            {errors.map((err) => (
              <p key={err}>{err}</p>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Сохранение...' : 'Создать промокод'}</span>
          </button>
        </div>
      </form>

      {/* Active & Paused Promos List */}
      <div className="rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] divide-y divide-[var(--svv-border)]">
        {promos.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--svv-muted)]">
            Промокоды ещё не созданы.
          </div>
        ) : (
          promos.map((promo) => (
            <div
              key={promo.code}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-sm font-bold text-[var(--svv-text)] tracking-wider">
                    {promo.code}
                  </span>
                  <span className="text-xs text-[var(--svv-accent)] font-semibold tabular-nums">
                    {promo.discountType === 'percent'
                      ? `−${promo.discountValue}%`
                      : `−${formatRub(promo.discountValue)}`}
                  </span>
                  {promo.minSubtotal > 0 && (
                    <span className="text-[11px] text-[var(--svv-muted)] tabular-nums">
                      · от {formatRub(promo.minSubtotal)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--svv-muted)] mt-0.5 truncate">{promo.label}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void onTogglePromo(promo.code, !promo.active)}
                  className={`min-h-[36px] px-3.5 rounded-full border text-xs font-semibold press-spring cursor-pointer ${
                    promo.active
                      ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                      : 'bg-transparent text-[var(--svv-muted)] border-[var(--svv-border)] hover:text-[var(--svv-text)]'
                  }`}
                >
                  {promo.active ? 'Активен' : 'Отключён'}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeletePromo(promo.code)}
                  aria-label={`Удалить промокод ${promo.code}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 hover:border-red-500/40 press-spring cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
