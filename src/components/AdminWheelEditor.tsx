import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus, RotateCw, Trash2 } from 'lucide-react';
import type {
  PrizeWheelConfig,
  PrizeWheelSegment,
  PromoCodeItem,
  WheelAccent,
} from '../data/catalog';
import { validateWheelSegments } from '../utils/shopLogic';
import { PrizeWheelGraphic } from './PrizeWheelGraphic';

interface AdminWheelEditorProps {
  wheelConfig: PrizeWheelConfig;
  promos: PromoCodeItem[];
  onSaveWheel: (nextWheel: PrizeWheelConfig) => Promise<void>;
}

const ACCENT_OPTIONS: Array<{ id: WheelAccent; label: string }> = [
  { id: 'obsidian', label: 'Чёрный' },
  { id: 'bone', label: 'Молочный' },
  { id: 'smoke', label: 'Графит' },
  { id: 'crimson', label: 'Тёмно-бордовый' },
];

export function AdminWheelEditor({
  wheelConfig,
  promos,
  onSaveWheel,
}: AdminWheelEditorProps) {
  const [draft, setDraft] = useState<PrizeWheelConfig>(wheelConfig);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setDraft(wheelConfig);
  }, [wheelConfig]);

  const updateSegment = (index: number, patch: Partial<PrizeWheelSegment>) => {
    setDraft((prev) => ({
      ...prev,
      segments: prev.segments.map((seg, idx) => (idx === index ? { ...seg, ...patch } : seg)),
    }));
    setSavedOk(false);
  };

  const handleAddSegment = () => {
    if (draft.segments.length >= 10) return;
    const nextIdx = draft.segments.length + 1;
    const accents: WheelAccent[] = ['obsidian', 'bone', 'smoke', 'crimson'];
    setDraft((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        {
          id: `seg-${Date.now()}-${nextIdx}`,
          label: `Новый приз #${nextIdx}`,
          shortLabel: `ПРИЗ ${nextIdx}`,
          promoCode: promos[0]?.code ?? '',
          description: 'Бонус при оформлении заказа.',
          weight: 15,
          accent: accents[nextIdx % accents.length],
        },
      ],
    }));
    setSavedOk(false);
  };

  const handleRemoveSegment = (index: number) => {
    if (draft.segments.length <= 2) return;
    setDraft((prev) => ({
      ...prev,
      segments: prev.segments.filter((_, idx) => idx !== index),
    }));
    setSavedOk(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateWheelSegments(draft.segments);
    if (draft.title.trim().length < 2) {
      errs.unshift('Укажите заголовок колеса призов.');
    }
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await onSaveWheel({
        ...draft,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        segments: draft.segments.map((s) => ({
          ...s,
          label: s.label.trim(),
          shortLabel: s.shortLabel.trim(),
          promoCode: s.promoCode.trim().toUpperCase(),
          description: s.description.trim(),
          weight: Math.min(100, Math.max(1, Math.round(s.weight))),
        })),
      });
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Не удалось сохранить колесо.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Top settings + live mini preview */}
      <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
        <div className="md:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-[var(--svv-accent)]" />
              <h2 className="text-sm font-bold text-[var(--svv-text)]">Настройки колеса призов</h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setDraft((prev) => ({ ...prev, enabled: !prev.enabled }));
                setSavedOk(false);
              }}
              aria-pressed={draft.enabled}
              className={`min-h-[36px] px-3.5 rounded-full border text-xs font-semibold press-spring cursor-pointer ${
                draft.enabled
                  ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                  : 'bg-transparent text-[var(--svv-muted)] border-[var(--svv-border)]'
              }`}
            >
              {draft.enabled ? 'Включено на главной' : 'Скрыто на главной'}
            </button>
          </div>

          <div>
            <label htmlFor="wheel-title" className="block text-xs text-[var(--svv-muted)] mb-1">
              Заголовок блока
            </label>
            <input
              id="wheel-title"
              type="text"
              value={draft.title}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, title: e.target.value }));
                setSavedOk(false);
              }}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="wheel-subtitle" className="block text-xs text-[var(--svv-muted)] mb-1">
              Подзаголовок
            </label>
            <input
              id="wheel-subtitle"
              type="text"
              value={draft.subtitle}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, subtitle: e.target.value }));
                setSavedOk(false);
              }}
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <PrizeWheelGraphic segments={draft.segments} size="sm" />
          <p className="mt-2 text-[11px] text-[var(--svv-muted)]">Предпросмотр ({draft.segments.length})</p>
        </div>
      </div>

      {/* Sectors Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--svv-muted)]">
            Сектора колеса ({draft.segments.length} / 10)
          </h3>
          {draft.segments.length < 10 && (
            <button
              type="button"
              onClick={handleAddSegment}
              className="min-h-[38px] px-3.5 rounded-full border border-[var(--svv-border)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] press-spring inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить сектор</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {draft.segments.map((seg, idx) => (
            <div
              key={seg.id}
              className="p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-[var(--svv-accent)]">Сектор #{idx + 1}</span>
                {draft.segments.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSegment(idx)}
                    aria-label={`Удалить сектор ${seg.label}`}
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 hover:border-red-500/40 press-spring cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor={`seg-label-${seg.id}`}
                    className="block text-[11px] text-[var(--svv-muted)] mb-1"
                  >
                    Полное название приза
                  </label>
                  <input
                    id={`seg-label-${seg.id}`}
                    type="text"
                    value={seg.label}
                    onChange={(e) => updateSegment(idx, { label: e.target.value })}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`seg-short-${seg.id}`}
                    className="block text-[11px] text-[var(--svv-muted)] mb-1"
                  >
                    Текст на секторе
                  </label>
                  <input
                    id={`seg-short-${seg.id}`}
                    type="text"
                    value={seg.shortLabel}
                    maxLength={14}
                    onChange={(e) => updateSegment(idx, { shortLabel: e.target.value })}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-bold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`seg-promo-${seg.id}`}
                    className="block text-[11px] text-[var(--svv-muted)] mb-1"
                  >
                    Промокод (если есть)
                  </label>
                  <input
                    id={`seg-promo-${seg.id}`}
                    list="wheel-promo-list"
                    type="text"
                    value={seg.promoCode}
                    onChange={(e) =>
                      updateSegment(idx, { promoCode: e.target.value.toUpperCase() })
                    }
                    placeholder="Без кода"
                    className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-mono uppercase text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={`seg-weight-${seg.id}`}
                      className="block text-[11px] text-[var(--svv-muted)] mb-1"
                    >
                      Вес (шанс)
                    </label>
                    <input
                      id={`seg-weight-${seg.id}`}
                      type="number"
                      min={1}
                      max={100}
                      value={seg.weight}
                      onChange={(e) =>
                        updateSegment(idx, { weight: Number(e.target.value) || 1 })
                      }
                      className="w-full min-h-[40px] px-2.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-border-strong)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`seg-accent-${seg.id}`}
                      className="block text-[11px] text-[var(--svv-muted)] mb-1"
                    >
                      Цвет
                    </label>
                    <select
                      id={`seg-accent-${seg.id}`}
                      value={seg.accent}
                      onChange={(e) =>
                        updateSegment(idx, { accent: e.target.value as WheelAccent })
                      }
                      className="w-full min-h-[40px] px-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                    >
                      {ACCENT_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor={`seg-desc-${seg.id}`}
                  className="block text-[11px] text-[var(--svv-muted)] mb-1"
                >
                  Пояснение после выигрыша
                </label>
                <input
                  id={`seg-desc-${seg.id}`}
                  type="text"
                  value={seg.description}
                  onChange={(e) => updateSegment(idx, { description: e.target.value })}
                  className="w-full min-h-[38px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text-soft)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                />
              </div>
            </div>
          ))}
        </div>

        <datalist id="wheel-promo-list">
          {promos.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </datalist>
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

      <div className="flex items-center justify-end gap-3">
        {savedOk && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--svv-accent)]">
            <Check className="w-3.5 h-3.5" />
            Сохранено
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-[46px] px-6 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
        >
          {saving ? 'Сохранение...' : 'Сохранить колесо призов'}
        </button>
      </div>
    </form>
  );
}
