import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Camera, CheckCircle2, ExternalLink, Globe, ImagePlus, Link2, Trash2, Truck } from 'lucide-react';
import { CHINA_BUYOUT_PRESETS, MANAGER_TELEGRAM_HANDLE } from '../data/catalog';
import {
  calculateChinaBuyoutQuote,
  CHINA_AIR_SHIPPING_USD,
  CHINA_CARGO_RUB_PER_KG,
  formatCny,
  formatRub,
  normalizeTelegramHandle,
  validateChinaBuyoutInput,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

export interface BuyoutTicket {
  id: string;
  buyoutLink?: string;
  sourceUrlOrName: string;
  brand: string;
  size: string;
  priceCny: number;
  estimatedRub: number;
  shippingUsd?: number;
  weightKg?: number;
  shippingSpeed: 'air' | 'cargo';
  telegramHandle: string;
  imageUrl?: string;
}

interface ChinaBuyoutSectionProps {
  defaultHandle: string;
  onSubmitted?: (ticket: BuyoutTicket) => void;
  onGoToTracking?: (orderCode: string) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Не удалось прочитать файл.'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения изображения.'));
    reader.readAsDataURL(file);
  });
}

export function ChinaBuyoutSection({
  defaultHandle,
  onSubmitted,
  onGoToTracking,
}: ChinaBuyoutSectionProps) {
  const [priceCnyRaw, setPriceCnyRaw] = useState('0');
  const [shippingSpeed, setShippingSpeed] = useState<'air' | 'cargo'>('air');
  const [weightKgRaw, setWeightKgRaw] = useState('1');

  const [buyoutLink, setBuyoutLink] = useState('');
  const [sourceUrlOrName, setSourceUrlOrName] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('EU 42 / M');
  const [telegramHandle, setTelegramHandle] = useState(defaultHandle);
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<BuyoutTicket | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const numericCny = Number(priceCnyRaw.replace(/\s+/g, '')) || 0;
  const numericWeightKg = Number(weightKgRaw.replace(',', '.')) || 1;
  const quote = calculateChinaBuyoutQuote({
    priceCny: numericCny,
    shippingSpeed,
    weightKg: numericWeightKg,
  });

  const applyPreset = (presetId: string) => {
    const preset = CHINA_BUYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setPriceCnyRaw(String(preset.priceCny));
    setSize(preset.sizeHint);
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingPhoto(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/buyouts/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Не удалось загрузить фото вещи.');
      }
      setImageUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки изображения.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateChinaBuyoutInput({
      buyoutLink,
      sourceUrlOrName,
      brand,
      size,
      priceCny: numericCny,
      telegramHandle,
      imageUrl,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    const cleanLink = buyoutLink.trim();
    const cleanName = sourceUrlOrName.trim() || cleanLink;
    try {
      const res = await fetch('/api/buyouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyoutLink: cleanLink || undefined,
          sourceUrlOrName: cleanName,
          brand: brand.trim(),
          size: size.trim(),
          priceCny: Math.round(numericCny),
          estimatedRub: quote.totalRub,
          shippingUsd: quote.shippingUsd,
          weightKg: shippingSpeed === 'cargo' ? quote.weightKg : undefined,
          shippingSpeed,
          telegramHandle: normalizeTelegramHandle(telegramHandle),
          imageUrl: imageUrl.trim() || undefined,
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
        buyoutLink: cleanLink || undefined,
        sourceUrlOrName: cleanName,
        brand: brand.trim() || 'Выкуп из Китая',
        size: size.trim() || 'Уточнить',
        priceCny: Math.round(numericCny),
        estimatedRub: quote.totalRub,
        shippingUsd: quote.shippingUsd,
        weightKg: shippingSpeed === 'cargo' ? quote.weightKg : undefined,
        shippingSpeed,
        telegramHandle: normalizeTelegramHandle(telegramHandle),
        imageUrl: imageUrl.trim() || undefined,
      };
      setReceipt(ticket);
      if (onSubmitted) onSubmitted(ticket);
    } catch {
      const fallbackTicket: BuyoutTicket = {
        id: `CN-${Math.floor(1000 + Math.random() * 9000)}`,
        buyoutLink: cleanLink || undefined,
        sourceUrlOrName: cleanName,
        brand: brand.trim() || 'Выкуп из Китая',
        size: size.trim() || 'Уточнить',
        priceCny: Math.round(numericCny),
        estimatedRub: quote.totalRub,
        shippingUsd: quote.shippingUsd,
        weightKg: shippingSpeed === 'cargo' ? quote.weightKg : undefined,
        shippingSpeed,
        telegramHandle: normalizeTelegramHandle(telegramHandle),
        imageUrl: imageUrl.trim() || undefined,
      };
      setReceipt(fallbackTicket);
      if (onSubmitted) onSubmitted(fallbackTicket);
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTotalSummary =
    numericCny <= 0
      ? '0 ₽'
      : quote.shippingUsd > 0
      ? `${formatRub(quote.totalRub)} + $${quote.shippingUsd}`
      : formatRub(quote.totalRub);

  return (
    <section className="py-5 sm:py-8 px-4 sm:px-0 max-w-4xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-[var(--svv-muted)]">
          <Globe className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
          <span>Прямой выкуп и доставка · 1 ¥ = {quote.cnyRate} ₽</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--svv-text)] tracking-tight">
          Выкуп из Китая под ключ
        </h1>
        <p className="text-xs sm:text-sm text-[var(--svv-muted)] max-w-2xl">
          Укажите цену в юанях по точному курсу {quote.cnyRate} ₽, выберите Авиа (${CHINA_AIR_SHIPPING_USD})
          или Карго авто ({CHINA_CARGO_RUB_PER_KG} ₽/кг), прикрепите ссылку и фото вещи.
        </p>
      </div>

      {/* Quick Category Templates */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-[var(--svv-muted)]">Быстрая подстановка цены:</p>
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
            <h2 className="text-base font-bold text-[var(--svv-text)]">Калькулятор выкупа</h2>
            <span className="text-xs font-mono text-[var(--svv-accent)] font-semibold tabular-nums">
              1 ¥ = {quote.cnyRate} ₽
            </span>
          </div>

          <div>
            <label htmlFor="cny-input" className="block text-xs text-[var(--svv-muted)] mb-1.5">
              Цена товара в юанях (¥)
            </label>
            <input
              id="cny-input"
              type="number"
              min={0}
              value={priceCnyRaw}
              onFocus={() => {
                if (priceCnyRaw === '0') setPriceCnyRaw('');
              }}
              onBlur={() => {
                if (!priceCnyRaw.trim()) setPriceCnyRaw('0');
              }}
              onChange={(e) => setPriceCnyRaw(e.target.value)}
              placeholder="0"
              className="w-full min-h-[46px] px-4 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-base font-semibold text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-accent)]"
            />
          </div>

          <div>
            <span className="block text-xs text-[var(--svv-muted)] mb-1.5">
              Способ доставки из Китая
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShippingSpeed('air')}
                className={`min-h-[50px] px-3 py-2 rounded-xl text-left border cursor-pointer transition-colors ${
                  shippingSpeed === 'air'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                <span className="block text-xs font-bold">Авиа экспресс</span>
                <span
                  className={`block text-[11px] tabular-nums ${
                    shippingSpeed === 'air' ? 'opacity-85' : 'text-[var(--svv-muted)]'
                  }`}
                >
                  ${CHINA_AIR_SHIPPING_USD} · 7–12 дней
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShippingSpeed('cargo')}
                className={`min-h-[50px] px-3 py-2 rounded-xl text-left border cursor-pointer transition-colors ${
                  shippingSpeed === 'cargo'
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                    : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                }`}
              >
                <span className="block text-xs font-bold">Карго авто</span>
                <span
                  className={`block text-[11px] tabular-nums ${
                    shippingSpeed === 'cargo' ? 'opacity-85' : 'text-[var(--svv-muted)]'
                  }`}
                >
                  {CHINA_CARGO_RUB_PER_KG} ₽/кг · 16–24 дня
                </span>
              </button>
            </div>
          </div>

          {shippingSpeed === 'cargo' && (
            <div>
              <label htmlFor="cargo-weight-input" className="block text-xs text-[var(--svv-muted)] mb-1.5">
                Примерный вес для расчёта карго (кг × {CHINA_CARGO_RUB_PER_KG} ₽)
              </label>
              <input
                id="cargo-weight-input"
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={weightKgRaw}
                onChange={(e) => setWeightKgRaw(e.target.value)}
                className="w-full min-h-[42px] px-4 py-1.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm font-semibold text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-accent)]"
              />
            </div>
          )}

          <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2 text-xs">
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>
                Товар ({formatCny(numericCny)} × {quote.cnyRate} ₽)
              </span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.goodsRub)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Осмотр и фотоотчёт со склада</span>
              <span className="text-[var(--svv-accent)] font-semibold">Бесплатно</span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>
                {shippingSpeed === 'air'
                  ? 'Авиа доставка (7–12 дней)'
                  : `Карго авто (${quote.weightKg} кг × ${CHINA_CARGO_RUB_PER_KG} ₽)`}
              </span>
              <span className="text-[var(--svv-text)] tabular-nums font-medium">
                {shippingSpeed === 'air'
                  ? `$${CHINA_AIR_SHIPPING_USD}`
                  : formatRub(quote.shippingRub)}
              </span>
            </div>
            <div className="flex justify-between text-[var(--svv-muted)]">
              <span>Комиссия выкупа (9%)</span>
              <span className="text-[var(--svv-text)] tabular-nums">
                {formatRub(quote.serviceFeeRub)}
              </span>
            </div>
            <div className="pt-2.5 border-t border-[var(--svv-border)] flex justify-between items-baseline gap-2">
              <span className="text-sm font-semibold text-[var(--svv-text)]">Итого к выкупу</span>
              <span className="text-xl font-bold text-[var(--svv-text)] tabular-nums text-right">
                {formattedTotalSummary}
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
                    Бесплатный фотоотчёт со склада отправим в Telegram ({receipt.telegramHandle}).
                    Статус можно отслеживать в «Личном кабинете».
                  </p>
                </div>
              </div>

              {receipt.imageUrl && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)]">
                  <img
                    src={receipt.imageUrl}
                    alt={receipt.sourceUrlOrName}
                    referrerPolicy="no-referrer"
                    className="w-14 h-16 rounded-lg object-cover bg-[var(--svv-well)] shrink-0"
                  />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-[var(--svv-text)] truncate">
                      {receipt.sourceUrlOrName}
                    </p>
                    {receipt.buyoutLink && (
                      <p className="text-[11px] text-[var(--svv-muted)] truncate mt-0.5">
                        {receipt.buyoutLink}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Позиция</span>
                  <span className="text-[var(--svv-text)] font-medium text-right truncate max-w-[65%]">
                    {receipt.sourceUrlOrName}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Размер</span>
                  <span className="text-[var(--svv-text)]">{receipt.size}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Отчёт со склада</span>
                  <span className="text-[var(--svv-accent)] font-semibold">Бесплатно</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--svv-muted)]">Расчёт (курс 13.8 · 9%)</span>
                  <span className="text-[var(--svv-text)] font-bold tabular-nums">
                    {formatRub(receipt.estimatedRub)}
                    {receipt.shippingUsd ? ` + $${receipt.shippingUsd}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {(() => {
                  const tgUrl = buildTelegramConciergeUrl(
                    MANAGER_TELEGRAM_HANDLE,
                    `Выкуп из Китая ${receipt.id}: ${receipt.brand} — ${receipt.sourceUrlOrName}${
                      receipt.buyoutLink ? ` (${receipt.buyoutLink})` : ''
                    }, размер ${receipt.size}, цена ${receipt.priceCny} ¥ (итого ${formatRub(
                      receipt.estimatedRub
                    )}${receipt.shippingUsd ? ` + $${receipt.shippingUsd}` : ''})`
                  );
                  return (
                    <a
                      href={tgUrl}
                      onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[46px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Отправить заявку менеджеру в Telegram</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  );
                })()}
                {onGoToTracking && (
                  <button
                    type="button"
                    onClick={() => onGoToTracking(receipt.id)}
                    className="w-full min-h-[42px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] cursor-pointer"
                  >
                    Отследить в Личном кабинете
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setReceipt(null);
                    setBuyoutLink('');
                    setSourceUrlOrName('');
                    setImageUrl('');
                  }}
                  className="w-full min-h-[40px] px-4 rounded-full text-xs font-medium text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
                >
                  Оформить ещё один выкуп
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <h2 className="text-base font-bold text-[var(--svv-text)]">Заявка на выкуп вещи</h2>

              <div>
                <label htmlFor="buyout-url" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Ссылка на выкуп (Poizon / Taobao / 1688 / Weidian)
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-[var(--svv-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="buyout-url"
                    type="url"
                    value={buyoutLink}
                    onChange={(e) => setBuyoutLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="buyout-link" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Название вещи / модель
                </label>
                <input
                  id="buyout-link"
                  type="text"
                  value={sourceUrlOrName}
                  onChange={(e) => setSourceUrlOrName(e.target.value)}
                  placeholder="Например, Пуховик / Кроссовки и цвет"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
              </div>

              {/* Photo Attachment */}
              <div className="p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--svv-text)]">
                    Закрепить фото вещи
                  </span>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      aria-label="Удалить прикреплённое фото"
                      className="text-[11px] text-[var(--svv-muted)] hover:text-red-500 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Убрать</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Фото вещи для выкупа"
                      referrerPolicy="no-referrer"
                      className="w-14 h-16 rounded-lg object-cover bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handlePhotoChange(e)}
                      className="hidden"
                      id="buyout-photo-upload"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="w-full min-h-[40px] px-3.5 py-1.5 rounded-full border border-[var(--svv-border-strong)] bg-[var(--svv-surface)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>
                        {uploadingPhoto
                          ? 'Загрузка фото...'
                          : imageUrl
                          ? 'Заменить фото вещи'
                          : 'Прикрепить фото (JPG / PNG)'}
                      </span>
                    </button>
                  </div>
                </div>

                {uploadError && (
                  <p role="alert" className="text-[11px] text-[var(--svv-danger-fg)]">
                    {uploadError}
                  </p>
                )}
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
                disabled={submitting || uploadingPhoto}
                className="w-full min-h-[48px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-sm font-bold hover:bg-[var(--svv-accent-hover)] transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Отправка...'
                  : `Отправить на выкуп · ${formattedTotalSummary}`}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 3-step trust strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Camera className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">Фотоотчёт со склада — бесплатно</p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Живые фото, бирки и замеры вещи на складе в Китае без доплат перед отправкой.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Truck className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">
              Авиа ${CHINA_AIR_SHIPPING_USD} · Карго {CHINA_CARGO_RUB_PER_KG} ₽/кг
            </p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Комиссия сервиса 9%, точный курс {quote.cnyRate} ₽ за юань и трекинг в личном кабинете.
            </p>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] flex items-start gap-3">
          <Globe className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[var(--svv-text)]">Любые площадки Китая</p>
            <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
              Выкупаем по вашей ссылке или фото, закрепляйте изображение прямо в форме.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
