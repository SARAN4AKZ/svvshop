import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Pencil, Plus, RefreshCw, Search, Trash2, Truck } from 'lucide-react';
import { TRACKING_STAGES, type TrackingRecord, type TrackingStage } from '../data/catalog';
import {
  formatRequestTimestamp,
  getTrackingStageLabel,
  normalizeTelegramHandle,
  validateTrackingInput,
} from '../utils/shopLogic';

export interface TrackingDraft {
  id?: string;
  orderCode: string;
  telegramHandle: string;
  itemTitle: string;
  imageUrl?: string;
  stage: TrackingStage;
  carrierTrack: string;
  deliveryMethod: string;
  etaLabel: string;
  locationNote: string;
}

const EMPTY_TRACKING_DRAFT: TrackingDraft = {
  orderCode: '',
  telegramHandle: '',
  itemTitle: '',
  imageUrl: '',
  stage: 'confirmed',
  carrierTrack: '',
  deliveryMethod: 'Авиа ($45)',
  etaLabel: '',
  locationNote: '',
};

interface AdminTrackingManagerProps {
  adminBearerToken: string;
  prefillDraft?: TrackingDraft | null;
  onConsumePrefill?: () => void;
}

export function AdminTrackingManager({
  adminBearerToken,
  prefillDraft,
  onConsumePrefill,
}: AdminTrackingManagerProps) {
  const [records, setRecords] = useState<TrackingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<TrackingDraft>(EMPTY_TRACKING_DRAFT);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tracking', {
        headers: { Authorization: `Bearer ${adminBearerToken}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { records?: TrackingRecord[] };
      if (Array.isArray(data.records)) {
        setRecords(data.records);
      }
    } catch {
      // Ignore transient offline errors
    } finally {
      setLoading(false);
    }
  }, [adminBearerToken]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!prefillDraft) return;
    setDraft(prefillDraft);
    setErrors([]);
    setNotice(null);
    setIsFormOpen(true);
    onConsumePrefill?.();
  }, [prefillDraft, onConsumePrefill]);

  const openCreateForm = () => {
    setDraft(EMPTY_TRACKING_DRAFT);
    setErrors([]);
    setNotice(null);
    setIsFormOpen(true);
  };

  const openEditRecord = (rec: TrackingRecord) => {
    setDraft({
      id: rec.id,
      orderCode: rec.orderCode,
      telegramHandle: rec.telegramHandle,
      itemTitle: rec.itemTitle,
      imageUrl: rec.imageUrl ?? '',
      stage: rec.stage,
      carrierTrack: rec.carrierTrack,
      deliveryMethod: rec.deliveryMethod,
      etaLabel: rec.etaLabel,
      locationNote: rec.locationNote,
    });
    setErrors([]);
    setNotice(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateTrackingInput({
      orderCode: draft.orderCode,
      telegramHandle: draft.telegramHandle,
      itemTitle: draft.itemTitle,
      imageUrl: draft.imageUrl,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors([]);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({
          id: draft.id,
          orderCode: draft.orderCode.trim(),
          telegramHandle: normalizeTelegramHandle(draft.telegramHandle),
          itemTitle: draft.itemTitle.trim(),
          imageUrl: draft.imageUrl?.trim() || undefined,
          stage: draft.stage,
          carrierTrack: draft.carrierTrack.trim(),
          deliveryMethod: draft.deliveryMethod.trim(),
          etaLabel: draft.etaLabel.trim(),
          locationNote: draft.locationNote.trim(),
        }),
      });
      const data = (await res.json()) as { record?: TrackingRecord; error?: string };
      if (!res.ok || !data.record) {
        throw new Error(data.error || 'Не удалось сохранить запись трекинга.');
      }

      setRecords((prev) => [
        data.record!,
        ...prev.filter(
          (r) =>
            r.id !== data.record!.id &&
            r.orderCode.toLowerCase() !== data.record!.orderCode.toLowerCase()
        ),
      ]);
      setIsFormOpen(false);
      setNotice(`Трекинг ${data.record.orderCode} обновлён (${getTrackingStageLabel(data.record.stage)}).`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Ошибка сохранения трекинга.']);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/tracking/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminBearerToken}` },
      });
      if (!res.ok) return;
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Ignore network errors
    }
  };

  const filteredRecords = records.filter((rec) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      rec.orderCode.toLowerCase().includes(q) ||
      rec.telegramHandle.toLowerCase().includes(q) ||
      rec.carrierTrack.toLowerCase().includes(q) ||
      rec.itemTitle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--svv-text)] flex items-center gap-2">
            <Truck className="w-4 h-4 text-[var(--svv-accent)]" />
            <span>Трекинг отправлений клиентов</span>
          </h2>
          <p className="text-xs text-[var(--svv-muted)] mt-0.5">
            Заполняйте трек-код, статус маршрута и комментарий — клиент увидит их в «Личном кабинете».
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadRecords()}
            disabled={loading}
            className="min-h-[38px] px-3.5 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="min-h-[38px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить трек</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] text-xs text-[var(--svv-text)]"
        >
          {notice}
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSave}
          noValidate
          className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border-strong)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--svv-text)]">
              {draft.id ? `Редактировать трек ${draft.orderCode}` : 'Новая запись трекинга'}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
            >
              Закрыть
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="trk-order-code" className="block text-xs text-[var(--svv-muted)] mb-1">
                Код заказа / заявки
              </label>
              <input
                id="trk-order-code"
                type="text"
                value={draft.orderCode}
                onChange={(e) => setDraft((d) => ({ ...d, orderCode: e.target.value }))}
                placeholder="SVV-1042 или CN-2048"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>

            <div>
              <label htmlFor="trk-tg-handle" className="block text-xs text-[var(--svv-muted)] mb-1">
                Telegram клиента (@username)
              </label>
              <input
                id="trk-tg-handle"
                type="text"
                value={draft.telegramHandle}
                onChange={(e) => setDraft((d) => ({ ...d, telegramHandle: e.target.value }))}
                placeholder="@client_username"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="trk-item-title" className="block text-xs text-[var(--svv-muted)] mb-1">
              Название вещи / посылки
            </label>
            <input
              id="trk-item-title"
              type="text"
              value={draft.itemTitle}
              onChange={(e) => setDraft((d) => ({ ...d, itemTitle: e.target.value }))}
              placeholder="Balenciaga Runner · 42 EU"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="trk-stage" className="block text-xs text-[var(--svv-muted)] mb-1">
                Этап доставки
              </label>
              <select
                id="trk-stage"
                value={draft.stage}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, stage: e.target.value as TrackingStage }))
                }
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              >
                {TRACKING_STAGES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="trk-carrier" className="block text-xs text-[var(--svv-muted)] mb-1">
                Трек-номер (СДЭК / SF / Авиа)
              </label>
              <input
                id="trk-carrier"
                type="text"
                value={draft.carrierTrack}
                onChange={(e) => setDraft((d) => ({ ...d, carrierTrack: e.target.value }))}
                placeholder="CDEK-991122"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm font-mono text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="trk-method" className="block text-xs text-[var(--svv-muted)] mb-1">
                Способ доставки
              </label>
              <input
                id="trk-method"
                type="text"
                value={draft.deliveryMethod}
                onChange={(e) => setDraft((d) => ({ ...d, deliveryMethod: e.target.value }))}
                placeholder="Авиа ($45) или Карго авто"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>

            <div>
              <label htmlFor="trk-eta" className="block text-xs text-[var(--svv-muted)] mb-1">
                Ориентир по срокам
              </label>
              <input
                id="trk-eta"
                type="text"
                value={draft.etaLabel}
                onChange={(e) => setDraft((d) => ({ ...d, etaLabel: e.target.value }))}
                placeholder="7–12 дней"
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="trk-note" className="block text-xs text-[var(--svv-muted)] mb-1">
              Комментарий и текущее местоположение
            </label>
            <input
              id="trk-note"
              type="text"
              value={draft.locationNote}
              onChange={(e) => setDraft((d) => ({ ...d, locationNote: e.target.value }))}
              placeholder="Вещь выкуплена, проверка на складе в Гуанчжоу..."
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="trk-image" className="block text-xs text-[var(--svv-muted)] mb-1">
              Фото товара (необязательно: https://... или /uploads/...)
            </label>
            <input
              id="trk-image"
              type="text"
              value={draft.imageUrl ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, imageUrl: e.target.value }))}
              placeholder="/uploads/..."
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
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

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[40px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] cursor-pointer"
            >
              {saving ? 'Сохранение...' : 'Сохранить трекинг'}
            </button>
          </div>
        </form>
      )}

      {/* Search existing tracking */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--svv-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Фильтр по @username, коду заказа или трек-номеру..."
          className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs sm:text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-border-strong)]"
        />
      </div>

      {/* Records List */}
      <div className="border border-[var(--svv-border)] rounded-2xl bg-[var(--svv-surface)] divide-y divide-[var(--svv-border)]">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[var(--svv-text)]">
              {records.length === 0 ? 'Записей трекинга пока нет' : 'Совпадений не найдено'}
            </p>
            <p className="text-xs text-[var(--svv-muted)]">
              Записи создаются автоматически при заказе/выкупе либо вручную кнопкой «Добавить трек».
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {rec.imageUrl && (
                  <img
                    src={rec.imageUrl}
                    alt={rec.itemTitle}
                    referrerPolicy="no-referrer"
                    className="w-11 h-14 rounded-xl object-cover bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0"
                  />
                )}
                <div className="min-w-0 space-y-0.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-[var(--svv-muted)]">
                    <span className="font-bold text-[var(--svv-accent)]">{rec.orderCode}</span>
                    <span>·</span>
                    <span>{rec.telegramHandle}</span>
                    <span>·</span>
                    <span>{formatRequestTimestamp(rec.updatedAt)}</span>
                  </div>
                  <p className="font-semibold text-[var(--svv-text)] truncate">{rec.itemTitle}</p>
                  <p className="text-[11px] font-semibold text-[var(--svv-accent)]">
                    {getTrackingStageLabel(rec.stage)}
                    {rec.carrierTrack ? ` · Трек: ${rec.carrierTrack}` : ' · Трек не задан'}
                  </p>
                  {rec.locationNote && (
                    <p className="text-[11px] text-[var(--svv-muted)] line-clamp-1">
                      {rec.locationNote}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditRecord(rec)}
                  aria-label={`Редактировать трек ${rec.orderCode}`}
                  className="min-h-[36px] min-w-[36px] rounded-full border border-[var(--svv-border)] text-[var(--svv-text)] hover:border-[var(--svv-border-strong)] flex items-center justify-center cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(rec.id)}
                  aria-label={`Удалить трек ${rec.orderCode}`}
                  className="min-h-[36px] min-w-[36px] rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 flex items-center justify-center cursor-pointer"
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
