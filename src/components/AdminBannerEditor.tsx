import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, ImagePlus, RotateCcw, Sparkles, X } from 'lucide-react';
import { DEFAULT_HERO_BANNER, type HeroBannerConfig } from '../data/catalog';
import { validateHeroBannerInput } from '../utils/shopLogic';

interface AdminBannerEditorProps {
  bannerConfig: HeroBannerConfig;
  adminBearerToken: string;
  onSaveBanner: (nextBanner: HeroBannerConfig) => Promise<void>;
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

export function AdminBannerEditor({
  bannerConfig,
  adminBearerToken,
  onSaveBanner,
}: AdminBannerEditorProps) {
  const [draft, setDraft] = useState<HeroBannerConfig>(bannerConfig);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(bannerConfig);
  }, [bannerConfig]);

  const updateField = <K extends keyof HeroBannerConfig>(key: K, value: HeroBannerConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSavedOk(false);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({ dataUrl }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Не удалось загрузить фон баннера.');
      }
      updateField('imageUrl', data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки изображения.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_HERO_BANNER });
    setErrors([]);
    setUploadError(null);
    setSavedOk(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateHeroBannerInput(draft);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    setErrors([]);
    try {
      await onSaveBanner({
        eyebrow: draft.eyebrow.trim() || DEFAULT_HERO_BANNER.eyebrow,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        description: draft.description.trim(),
        primaryCtaLabel: draft.primaryCtaLabel.trim(),
        secondaryCtaLabel: draft.secondaryCtaLabel.trim(),
        promoMetricLabel:
          draft.promoMetricLabel.trim() || DEFAULT_HERO_BANNER.promoMetricLabel,
        promoMetricValue:
          draft.promoMetricValue.trim() || DEFAULT_HERO_BANNER.promoMetricValue,
        sealTop: draft.sealTop.trim() || DEFAULT_HERO_BANNER.sealTop,
        sealBottom: draft.sealBottom.trim() || DEFAULT_HERO_BANNER.sealBottom,
        tickerOverride: draft.tickerOverride.trim(),
        imageUrl: draft.imageUrl.trim(),
      });
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Не удалось сохранить баннер.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--svv-accent)]" />
            <div>
              <h2 className="text-sm font-bold text-[var(--svv-text)]">
                Редактор главного баннера
              </h2>
              <p className="text-[11px] text-[var(--svv-muted)]">
                Текст, кнопки, бегущая строка и фоновое фото на главной странице магазина.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="min-h-[36px] px-3.5 rounded-full border border-[var(--svv-border)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] press-spring inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Сбросить шаблон</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="banner-eyebrow" className="block text-xs text-[var(--svv-muted)] mb-1">
              Верхняя метка (над заголовком)
            </label>
            <input
              id="banner-eyebrow"
              type="text"
              maxLength={80}
              value={draft.eyebrow}
              onChange={(e) => updateField('eyebrow', e.target.value)}
              placeholder={DEFAULT_HERO_BANNER.eyebrow}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-mono text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="banner-title" className="block text-xs text-[var(--svv-muted)] mb-1">
              Главный заголовок
            </label>
            <input
              id="banner-title"
              type="text"
              maxLength={60}
              value={draft.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder={DEFAULT_HERO_BANNER.title}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm font-bold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="banner-subtitle" className="block text-xs text-[var(--svv-muted)] mb-1">
            Подзаголовок
          </label>
          <input
            id="banner-subtitle"
            type="text"
            maxLength={140}
            value={draft.subtitle}
            onChange={(e) => updateField('subtitle', e.target.value)}
            placeholder={DEFAULT_HERO_BANNER.subtitle}
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
          />
        </div>

        <div>
          <label htmlFor="banner-description" className="block text-xs text-[var(--svv-muted)] mb-1">
            Описание баннера (оставьте пустым для авто-списка добавленных брендов)
          </label>
          <textarea
            id="banner-description"
            rows={2}
            maxLength={320}
            value={draft.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Например: Новое поступление уже в витрине, живые фото по запросу."
            className="w-full px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="banner-cta-primary" className="block text-xs text-[var(--svv-muted)] mb-1">
              Текст первой кнопки (Каталог)
            </label>
            <input
              id="banner-cta-primary"
              type="text"
              maxLength={40}
              value={draft.primaryCtaLabel}
              onChange={(e) => updateField('primaryCtaLabel', e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-semibold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label
              htmlFor="banner-cta-secondary"
              className="block text-xs text-[var(--svv-muted)] mb-1"
            >
              Текст второй кнопки (Выкуп)
            </label>
            <input
              id="banner-cta-secondary"
              type="text"
              maxLength={40}
              value={draft.secondaryCtaLabel}
              onChange={(e) => updateField('secondaryCtaLabel', e.target.value)}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-semibold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="banner-metric-label"
              className="block text-[11px] text-[var(--svv-muted)] mb-1"
            >
              Плашка: подпись
            </label>
            <input
              id="banner-metric-label"
              type="text"
              maxLength={40}
              value={draft.promoMetricLabel}
              onChange={(e) => updateField('promoMetricLabel', e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
          <div>
            <label
              htmlFor="banner-metric-value"
              className="block text-[11px] text-[var(--svv-muted)] mb-1"
            >
              Плашка: текст
            </label>
            <input
              id="banner-metric-value"
              type="text"
              maxLength={40}
              value={draft.promoMetricValue}
              onChange={(e) => updateField('promoMetricValue', e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-semibold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
          <div>
            <label htmlFor="banner-seal-top" className="block text-[11px] text-[var(--svv-muted)] mb-1">
              Печать: верх
            </label>
            <input
              id="banner-seal-top"
              type="text"
              maxLength={18}
              value={draft.sealTop}
              onChange={(e) => updateField('sealTop', e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-bold text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
          <div>
            <label
              htmlFor="banner-seal-bottom"
              className="block text-[11px] text-[var(--svv-muted)] mb-1"
            >
              Печать: низ
            </label>
            <input
              id="banner-seal-bottom"
              type="text"
              maxLength={18}
              value={draft.sealBottom}
              onChange={(e) => updateField('sealBottom', e.target.value)}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-mono uppercase text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
        </div>

        <div>
          <label htmlFor="banner-ticker" className="block text-xs text-[var(--svv-muted)] mb-1">
            Своя бегущая строка (оставьте пустым для автоматической строки)
          </label>
          <input
            id="banner-ticker"
            type="text"
            maxLength={280}
            value={draft.tickerOverride}
            onChange={(e) => updateField('tickerOverride', e.target.value)}
            placeholder="Например: SVV † SHOP † ЗИМНИЙ ДРОП † СКИДКА −10% ПО КОДУ SVV10"
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs font-mono text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
          />
        </div>

        {/* Optional Banner Background Photo */}
        <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--svv-text)]">
              Фоновое фото баннера (необязательно)
            </p>
            {draft.imageUrl && (
              <button
                type="button"
                onClick={() => updateField('imageUrl', '')}
                className="text-[11px] text-[var(--svv-muted)] hover:text-[var(--svv-text)] inline-flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Убрать фото</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 items-start">
            <div className="w-full sm:w-36 h-20 rounded-xl overflow-hidden bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0 flex items-center justify-center text-[10px] text-[var(--svv-muted)]">
              {draft.imageUrl ? (
                <img
                  src={draft.imageUrl}
                  alt="Фон главного баннера"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>Без фото (градиент)</span>
              )}
            </div>

            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handleImageUpload(e)}
                  className="hidden"
                  id="banner-image-file"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{uploadingImage ? 'Загрузка...' : 'Загрузить фото баннера'}</span>
                </button>
              </div>

              <input
                id="banner-image-url"
                type="text"
                aria-label="Ссылка на фото баннера"
                value={draft.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
                placeholder="https://... или /uploads/..."
                className="w-full min-h-[38px] px-3 rounded-xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />

              {uploadError && (
                <p role="alert" className="text-xs text-[var(--svv-danger-fg)]">
                  {uploadError}
                </p>
              )}
            </div>
          </div>
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

      <div className="flex items-center justify-end gap-3">
        {savedOk && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--svv-accent)]">
            <Check className="w-3.5 h-3.5" />
            Баннер обновлён
          </span>
        )}
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-6 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
        >
          {saving ? 'Сохранение...' : 'Сохранить баннер'}
        </button>
      </div>
    </form>
  );
}
