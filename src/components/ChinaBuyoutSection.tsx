import { useState, type FormEvent } from 'react';
import { Camera, CheckCircle2, ExternalLink, Globe, Truck } from 'lucide-react';
import { CHINA_BUYOUT_PRESETS, MANAGER_TELEGRAM_HANDLE } from '../data/catalog';
import {
  calculateChinaBuyoutQuote,
  formatCny,
  formatRub,
  normalizeTelegramHandle,
  validateChinaBuyoutInput,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

export interface BuyoutTicket {
  id: string;
  sourceUrlOrName: string;
  brand: string;
  size: string;
  priceCny: number;
  estimatedRub: number;
  shippingSpeed: 'air' | 'cargo';
  telegramHandle: string;
}

interface ChinaBuyoutSectionProps {
  defaultHandle: string;
  onSubmitted?: (ticket: BuyoutTicket) => void;
}

export function ChinaBuyoutSection({ defaultHandle, onSubmitted }: ChinaBuyoutSectionProps) {
  const [priceCnyRaw, setPriceCnyRaw] = useState('2450');
  const [category, setCategory] = useState<'sneakers' | 'hoodie' | 'jacket' | 'bag'>('sneakers');
  const [shippingSpeed, setShippingSpeed] = useState<'air' | 'cargo'>('air');

  const [sourceUrlOrName, setSourceUrlOrName] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('EU 42 / M');
  const [telegramHandle, setTelegramHandle] = useState(defaultHandle);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<BuyoutTicket | null>(null);

  const numericCny = Number(priceCnyRaw.replace(/\s+/g, '')) || 0;
  const quote = calculateChinaBuyoutQuote({
    priceCny: numericCny,
    category,
    shippingSpeed,
  });

  const applyPreset = (presetId: string) => {
    const preset = CHINA_BUYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPriceCnyRaw(String(preset.priceCny));
    setCategory(preset.category);
    setSize(preset.sizeHint);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateChinaBuyoutInput({
      sourceUrlOrName,
      brand,
      size,
      priceCny: numericCny,
      telegramHandle,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch('/api/buyouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceUrlOrName: sourceUrlOrName.trim(),
          brand: brand.trim(),
          size: size.trim(),
          priceCny: Math.round(numericCny),
          estimatedRub: quote.totalRub,
          shippingSpeed,
          telegramHandle: normalizeTelegramHandle(telegramHandle),
          notes: notes.trim(),
        }),
      });
      let createdId = `CN-${Math.floor(1000 + Math.random() * 9000)}`;
      if (res.ok) {
        const data = (await res.json()) as { submission?: { id?: string } };
        if (data.submission?.id) createdId = data.submission.id;
      }
      const ticket: BuyoutTicket = {
        id: createdId,
        sourceUrlOrName: sourceUrlOrName.trim(),
        brand: brand.trim() || 'Выкуп из Китая',
        size: size.trim() || 'Уточнить',
        priceCny: Math.round(numericCny),
        estimatedRub: quote.totalRub,
        shippingSpeed,
        telegramHandle: normalizeTelegramHandle(telegramHandle),
      };
      setReceipt(ticket);
      if (onSubmitted) onSubmitted(ticket);
    } catch {
      const fallbackTicket: BuyoutTicket = {
        id: `CN-${Math.floor(1000 + Math.random() * 9000)}`,
        sourceUrlOrName: sourceUrlOrName.trim(),
        brand: brand.trim() || 'Выкуп из Китая',
        size: size.trim() || 'Уточнить',
        priceCny: Math.round(numericCny),
        estimatedRub: quote.totalRub,
        shippingSpeed,
        telegramHandle: normalizeTelegramHandle(telegramHandle),
      };
      setReceipt(fallbackTicket);
      if (onSubmitted) onSubmitted(fallbackTicket);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="py-5 sm:py-8 px-4 sm:px-0 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-[var(--svv-muted)]">
          <Globe className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
          <span>Прямой выкуп и доставка</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--svv-text)] tracking-tight">
          Выкуп из Китая под ключ
        </h1>
        <p className="text-xs sm:text-sm text-[var(--svv-muted)] max-w-2xl">
          Рассчитайте точную стоимость с фотоотчётом и доставкой или отправьте ссылку на нужную
          позицию.
        </p>
      </div>

      {/* Quick Category Templates (zero unadded brands) */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--svv-muted)]">Быстрый расчёт по категории:</p>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {CHINA_BUYOUT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[var(--svv-surface)]/90 border border-[var(--svv-border)] text-xs text-[var(--svv-text)] hover:border-[var(--svv-border-strong)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {preset.label} · {formatCny(preset.priceCny)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Calculator Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--svv-text)]">Калькулятор стоимости</h2>
            <span className="text-xs font-mono text-[var(--svv-muted)] tabular-nums">
              1 ¥ ≈ {quote.cnyRate} ₽
            </span>
          </div>

          <div>
            <label htmlFor="cny-input" className="block text-xs text-[var(--svv-muted)] mb-1.5">
              Цена в юанях (¥)
            </label>
            <input
              id="cny-input"
              type="number"
              min={1}
              value={priceCnyRaw}
              onChange={(e) => setPriceCnyRaw(e.target.value)}
              placeholder="2450"
              className="w-full min-h-[46px] px-4 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-base font-semibold text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-accent)]"
            />
          </div>

          <div>
            <span className="block text-xs text-[var(--svv-muted)] mb-1.5">Тип вещи</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['sneakers', 'Кроссовки'],
                  ['hoodie', 'Худи / Свитшот'],
                  ['jacket', 'Куртка / Пуховик'],
                  ['bag', 'Сумка / Шапка'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`min-h-[42px] px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    category === id
                      ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                      : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)] hover:border-[var(--svv-border-strong)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs text-[var(--svv-muted)] mb-1.5">
              Способ доставки из Китая
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShippingSpeed('air')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-left border cursor-pointer ${
                  shippingSpeed === 'air'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                <span className="block text-xs font-bold">Авиа экспресс</span>
                <span
                  className={`block text-[11px] ${
                    shippingSpeed === 'air' ? 'opacity-75' : 'text-[var(--svv-muted)]'
                  }`}
                >
                  7–12 дней
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShippingSpeed('cargo')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-left border cursor-pointer ${
                  shippingSpeed === 'cargo'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                <span className="block text-xs font-bold">Карго авто</span>
                <span
                  className={`block text-[11px] ${
                    shippingSpeed === 'cargo' ? 'opacity-75' : 'text-[var(--svv-muted)]'
                  }`}
                >
                  16–24 дня
                </span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2 text-xs">
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Товар ({formatCny(numericCny)})</span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.goodsRub)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Осмотр и фотоотчёт со склада</span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.inspectionRub)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Доставка ({quote.etaLabel})</span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.shippingRub)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Комиссия выкупа SVV</span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.serviceFeeRub)}
              </span>
            </div>
            <div className="pt-2.5 border-t border-[var(--svv-border)] flex justify-between items-baseline">
              <span className="text-sm font-semibold text-[var(--svv-text)]">Итого под ключ</span>
              <span className="text-xl font-bold text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.totalRub)}
              </span>
            </div>
          </div>
        </div>

        {/* Buyout Order Form */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)]">
          {receipt ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[var(--svv-accent)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono text-[var(--svv-muted)]">{receipt.id}</p>
                  <h2 className="text-lg font-bold text-[var(--svv-text)]">
                    Заявка на выкуп принята
                  </h2>
                  <p className="mt-1 text-xs text-[var(--svv-muted)]">
                    Отправим фото товара с китайского склада и ссылку на оплату в Telegram (
                    {receipt.telegramHandle}).
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Позиция</span>
                  <span className="text-[var(--svv-text)] font-medium text-right">
                    {receipt.sourceUrlOrName}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Размер</span>
                  <span className="text-[var(--svv-text)]">{receipt.size}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Расчёт под ключ</span>
                  <span className="text-[var(--svv-text)] font-bold tabular-nums">
                    {formatRub(receipt.estimatedRub)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {(() => {
                  const tgUrl = buildTelegramConciergeUrl(
                    MANAGER_TELEGRAM_HANDLE,
                    `Выкуп из Китая ${receipt.id}: ${receipt.brand} — ${receipt.sourceUrlOrName}, размер ${receipt.size}, цена ${receipt.priceCny} ¥ (итого ~${formatRub(receipt.estimatedRub)})`
                  );
                  return (
                    <a
                      href={tgUrl}
                      onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[46px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Отправить ссылку менеджеру в Telegram</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setSourceUrlOrName('');
                  }}
                  className="w-full min-h-[42px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] cursor-pointer"
                >
                  Оформить ещё один выкуп
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <h2 className="text-base font-bold text-[var(--svv-text)]">Отправить ссылку на выкуп</h2>

              <div>
                <label htmlFor="buyout-link" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Ссылка или точное название вещи
                </label>
                <input
                  id="buyout-link"
                  type="text"
                  value={sourceUrlOrName}
                  onChange={(e) => setSourceUrlOrName(e.target.value)}
                  placeholder="https://... или название модели"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="buyout-brand" className="block text-xs text-[var(--svv-muted)] mb-1">
                    Бренд (если нужен)
                  </label>
                  <input
                    id="buyout-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Укажите бренд"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="buyout-size" className="block text-xs text-[var(--svv-muted)] mb-1">
                    Размер (EU / CN)
                  </label>
                  <input
                    id="buyout-size"
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="EU 42 / M"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="buyout-tg" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Telegram @username
                </label>
                <input
                  id="buyout-tg"
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
              </div>

              <div>
                <label htmlFor="buyout-notes" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Комментарий (необязательно)
                </label>
                <textarea
                  id="buyout-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Пожелания по упаковке, замерам или доставке..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-sm font-bold hover:bg-[var(--svv-accent-hover)] transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Отправка...'
                  : `Заказать выкуп · ${formatRub(quote.totalRub)}`}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3-step concise trust strip without authenticity badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Camera className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">Фотоотчёт со склада</p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Живые фото и замеры вещи со склада в Китае перед отправкой.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Truck className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">Страховка груза</p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Полная ответственность за посылку на всём пути до вашего города.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Globe className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">Любые площадки Китая</p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Поиск редких размеров, выкуп и доставка удобным тарифом.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
