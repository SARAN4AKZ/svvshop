import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
  User,
} from 'lucide-react';
import { MANAGER_TELEGRAM_HANDLE, TRACKING_STAGES, type TrackingRecord } from '../data/catalog';
import {
  formatRequestTimestamp,
  getTrackingStageIndex,
  getTrackingStageLabel,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

const STORAGE_TRACK_QUERY_KEY = 'svv_shop_tracking_query_v1';

interface AccountTrackingViewProps {
  defaultName: string;
  defaultHandle: string;
  initialLookupQuery?: string;
  savedOrderCodes: string[];
  onGoToCatalog: () => void;
  onGoToChinaBuyout: () => void;
}

export function AccountTrackingView({
  defaultName,
  defaultHandle,
  initialLookupQuery,
  savedOrderCodes,
  onGoToCatalog,
  onGoToChinaBuyout,
}: AccountTrackingViewProps) {
  const [queryInput, setQueryInput] = useState<string>(() => {
    if (initialLookupQuery?.trim()) return initialLookupQuery.trim();
    if (defaultHandle.trim()) return defaultHandle.trim();
    try {
      const saved = localStorage.getItem(STORAGE_TRACK_QUERY_KEY);
      if (saved?.trim()) return saved.trim();
    } catch {
      // Ignore storage errors
    }
    return savedOrderCodes[0] ?? '';
  });

  const [records, setRecords] = useState<TrackingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTracking = useCallback(
    async (rawQuery: string) => {
      const queries = new Set<string>();
      const trimmed = rawQuery.trim();
      if (trimmed.length >= 2) queries.add(trimmed);
      if (!trimmed && savedOrderCodes.length > 0) {
        for (const code of savedOrderCodes.slice(0, 6)) {
          queries.add(code);
        }
      }

      if (queries.size === 0) {
        setRecords([]);
        setSearchedOnce(false);
        return;
      }

      setLoading(true);
      try {
        const merged = new Map<string, TrackingRecord>();
        for (const q of queries) {
          const res = await fetch(`/api/tracking?q=${encodeURIComponent(q)}`);
          if (!res.ok) continue;
          const data = (await res.json()) as { records?: TrackingRecord[] };
          if (Array.isArray(data.records)) {
            for (const rec of data.records) {
              merged.set(rec.id, rec);
            }
          }
        }
        setRecords(Array.from(merged.values()));
        setSearchedOnce(true);
        if (trimmed) {
          try {
            localStorage.setItem(STORAGE_TRACK_QUERY_KEY, trimmed);
          } catch {
            // Ignore storage errors
          }
        }
      } catch {
        // Keep current results if offline
      } finally {
        setLoading(false);
      }
    },
    [savedOrderCodes]
  );

  useEffect(() => {
    if (initialLookupQuery?.trim()) {
      setQueryInput(initialLookupQuery.trim());
      void fetchTracking(initialLookupQuery.trim());
      return;
    }
    const seedQuery = queryInput.trim() || defaultHandle.trim() || savedOrderCodes[0] || '';
    if (seedQuery) {
      void fetchTracking(seedQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLookupQuery, defaultHandle]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    void fetchTracking(queryInput);
  };

  const handleCopyTrack = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <section className="py-5 sm:py-8 px-4 sm:px-0 max-w-4xl mx-auto space-y-6">
      {/* Header & Telegram Identity */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)]/90 backdrop-blur-md border border-[var(--svv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-[var(--svv-accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
              ЛИЧНЫЙ КАБИНЕТ · ТРЕКИНГ
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-black uppercase text-[var(--svv-text)] tracking-tight truncate">
              {defaultName || defaultHandle || 'Отслеживание заказов'}
            </h1>
            <p className="text-xs text-[var(--svv-muted)] leading-relaxed mt-0.5">
              {defaultHandle
                ? `Telegram профиль: ${defaultHandle}`
                : 'Введите @username или код заказа (например SVV-1042 или CN-2048)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchTracking(queryInput)}
          disabled={loading}
          className="min-h-[40px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] press-spring inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Обновление...' : 'Обновить статус'}</span>
        </button>
      </div>

      {/* Tracking Lookup Form */}
      <form
        onSubmit={handleSearchSubmit}
        className="p-4 sm:p-5 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)] space-y-3"
      >
        <label htmlFor="tracking-lookup-input" className="block text-xs font-semibold text-[var(--svv-text)]">
          Найти посылку по @username, номеру заказа или трек-коду
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--svv-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="tracking-lookup-input"
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="@username, CN-1234 или трек СДЭК"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] px-6 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer shrink-0"
          >
            Проверить трек
          </button>
        </div>

        {savedOrderCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-[var(--svv-muted)]">Ваши заявки:</span>
            {savedOrderCodes.slice(0, 5).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setQueryInput(code);
                  void fetchTracking(code);
                }}
                className="min-h-[28px] px-2.5 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border)] text-[11px] font-mono text-[var(--svv-text)] hover:border-[var(--svv-border-strong)] cursor-pointer"
              >
                {code}
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Tracking Results */}
      {records.length === 0 ? (
        <div className="py-12 px-5 text-center space-y-3 rounded-2xl bg-[var(--svv-surface)]/88 border border-[var(--svv-border)]">
          <PackageCheck className="w-8 h-8 text-[var(--svv-muted)] mx-auto" />
          <p className="text-base font-semibold text-[var(--svv-text)]">
            {searchedOnce ? 'Отправления по этому запросу не найдены' : 'Здесь появится трекинг ваших вещей'}
          </p>
          <p className="text-xs text-[var(--svv-muted)] max-w-md mx-auto leading-relaxed">
            {searchedOnce
              ? 'Проверьте написание @username или номера заказа. Администратор заполняет трек-номер и этапы доставки сразу после оформления.'
              : 'После заказа в каталоге или заявки на выкуп из Китая администратор добавит трек-номер и статус маршрута, и вы сможете отслеживать посылку здесь.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onGoToCatalog}
              className="min-h-[40px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold cursor-pointer"
            >
              Перейти в каталог
            </button>
            <button
              type="button"
              onClick={onGoToChinaBuyout}
              className="min-h-[40px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] cursor-pointer"
            >
              Выкуп из Китая
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const stageIdx = getTrackingStageIndex(rec.stage);
            const tgUrl = buildTelegramConciergeUrl(
              MANAGER_TELEGRAM_HANDLE,
              `Здравствуйте! Вопрос по трекингу заказа ${rec.orderCode} (${rec.itemTitle}).`
            );

            return (
              <article
                key={rec.id}
                className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)]/90 backdrop-blur-md border border-[var(--svv-border)] space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    {rec.imageUrl && (
                      <img
                        src={rec.imageUrl}
                        alt={rec.itemTitle}
                        referrerPolicy="no-referrer"
                        className="w-14 h-16 rounded-xl object-cover bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--svv-muted)]">
                        <span className="font-bold text-[var(--svv-accent)]">{rec.orderCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.telegramHandle}</span>
                        <span aria-hidden="true">·</span>
                        <span>Обновлено {formatRequestTimestamp(rec.updatedAt)}</span>
                      </div>
                      <h2 className="mt-1 text-base font-bold text-[var(--svv-text)] leading-snug">
                        {rec.itemTitle}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-[var(--svv-accent)]">
                        {getTrackingStageLabel(rec.stage)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5-Stage Shipment Timeline */}
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  {TRACKING_STAGES.map((step, idx) => {
                    const completed = idx <= stageIdx;
                    const current = idx === stageIdx;
                    return (
                      <div key={step.id} className="space-y-1.5">
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            completed
                              ? 'bg-[var(--svv-accent)]'
                              : 'bg-[var(--svv-input)] border border-[var(--svv-border)]'
                          }`}
                        />
                        <p
                          className={`text-[10px] sm:text-[11px] leading-tight truncate ${
                            current
                              ? 'font-bold text-[var(--svv-text)]'
                              : completed
                              ? 'font-medium text-[var(--svv-text-soft)]'
                              : 'text-[var(--svv-muted)]'
                          }`}
                        >
                          {step.shortLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Carrier Track + ETA + Admin Note */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[var(--svv-muted)]">Трек-номер</p>
                      <p className="font-mono font-bold text-[var(--svv-text)] truncate mt-0.5">
                        {rec.carrierTrack || 'Ожидается'}
                      </p>
                    </div>
                    {rec.carrierTrack && (
                      <button
                        type="button"
                        onClick={() => void handleCopyTrack(rec.id, rec.carrierTrack)}
                        aria-label={`Скопировать трек ${rec.carrierTrack}`}
                        className="min-h-[32px] min-w-[32px] rounded-lg border border-[var(--svv-border)] flex items-center justify-center text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] cursor-pointer shrink-0"
                      >
                        {copiedId === rec.id ? (
                          <Check className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)]">
                    <p className="text-[11px] text-[var(--svv-muted)] inline-flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      <span>Доставка и срок</span>
                    </p>
                    <p className="font-semibold text-[var(--svv-text)] truncate mt-0.5">
                      {rec.deliveryMethod || 'По согласованию'}
                      {rec.etaLabel ? ` · ${rec.etaLabel}` : ''}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)]">
                    <p className="text-[11px] text-[var(--svv-muted)] inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>Статус склада</span>
                    </p>
                    <p className="text-[var(--svv-text-soft)] line-clamp-2 mt-0.5">
                      {rec.locationNote || 'Менеджер обновит комментарий при движении посылки.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <a
                    href={tgUrl}
                    onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[36px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1.5"
                  >
                    <span>Уточнить у {MANAGER_TELEGRAM_HANDLE}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
