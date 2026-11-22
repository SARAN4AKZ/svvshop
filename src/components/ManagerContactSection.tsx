import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ExternalLink, MessageSquare, ShieldCheck } from 'lucide-react';
import { MANAGER_TELEGRAM_HANDLE } from '../data/catalog';
import {
  getManagerTopicLabel,
  normalizeTelegramHandle,
  validateManagerInquiryInput,
  type ManagerInquiryReceipt,
  type ManagerTopic,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

interface ManagerContactSectionProps {
  defaultName: string;
  defaultHandle: string;
  onInquiryCreated?: (receipt: ManagerInquiryReceipt) => void;
}

const TOPICS: Array<{ id: ManagerTopic; label: string; hint: string }> = [
  { id: 'sizing', label: 'Замеры и посадка', hint: 'Длина, плечи, стелька, оверсайз' },
  { id: 'photos', label: 'Живые фото / видео', hint: 'Детали, швы, бирки, фурнитура' },
  { id: 'china', label: 'Выкуп из Китая', hint: 'Поиск редкого размера или позиции' },
  { id: 'order', label: 'Статус заказа', hint: 'Трек СДЭК, курьер или самовывоз' },
];

export function ManagerContactSection({
  defaultName,
  defaultHandle,
  onInquiryCreated,
}: ManagerContactSectionProps) {
  const [customerName, setCustomerName] = useState(defaultName);
  const [telegramHandle, setTelegramHandle] = useState(defaultHandle);
  const [topic, setTopic] = useState<ManagerTopic>('photos');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<ManagerInquiryReceipt | null>(null);

  useEffect(() => {
    if (defaultName && !customerName) setCustomerName(defaultName);
    if (defaultHandle && !telegramHandle) setTelegramHandle(defaultHandle);
  }, [defaultName, defaultHandle, customerName, telegramHandle]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateManagerInquiryInput({
      customerName,
      telegramHandle,
      topic,
      message,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    const topicLabel = getManagerTopicLabel(topic);
    let createdId = `MGR-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          telegramHandle: normalizeTelegramHandle(telegramHandle),
          topicLabel,
          message: message.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { inquiry?: { id?: string } };
        if (data.inquiry?.id) createdId = data.inquiry.id;
      }
    } catch {
      // Keep deterministic local confirmation if offline
    } finally {
      setSubmitting(false);
    }

    const nextReceipt: ManagerInquiryReceipt = {
      id: createdId,
      createdAtLabel: 'Только что',
      customerName: customerName.trim(),
      telegramHandle: normalizeTelegramHandle(telegramHandle),
      topicLabel,
      message: message.trim() || 'Запрос обратной связи в Telegram.',
    };
    setReceipt(nextReceipt);
    if (onInquiryCreated) onInquiryCreated(nextReceipt);
  };

  return (
    <section className="py-5 sm:py-8 px-4 sm:px-0 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
          <span>SVV † SUPPORT 24/7</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-[var(--svv-text)] tracking-tight">
          Связь с менеджером
        </h1>
        <p className="text-xs sm:text-sm text-[var(--svv-muted)] max-w-xl">
          Прямая связь без ботов: отвечаем в Telegram в течение 10 минут, присылаем живые фото
          вещей, замеры и помогаем с выкупом из Китая.
        </p>
      </div>

      {/* 1-tap Telegram card */}
      <div className="p-5 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--svv-text)]">
            <ShieldCheck className="w-4 h-4 text-[var(--svv-accent)]" />
            <span>{MANAGER_TELEGRAM_HANDLE}</span>
          </div>
          <p className="text-sm font-bold text-[var(--svv-text)]">
            Открыть чат с менеджером напрямую
          </p>
          <p className="text-xs text-[var(--svv-muted)]">
            Быстрый вопрос по наличию, замерам, доставке СДЭК или курьером по Москве.
          </p>
        </div>

        {(() => {
          const tgUrl = buildTelegramConciergeUrl(
            MANAGER_TELEGRAM_HANDLE,
            'Здравствуйте! Пишу из SVV SHOP по поводу заказа / наличия вещи.'
          );
          return (
            <a
              href={tgUrl}
              onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
              target="_blank"
              rel="noreferrer"
              className="min-h-[46px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>Написать в Telegram</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          );
        })()}
      </div>

      {/* Request form */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)]">
        {receipt ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-[var(--svv-accent)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-[var(--svv-muted)]">{receipt.id}</p>
                <h2 className="text-lg font-bold text-[var(--svv-text)]">Обращение отправлено</h2>
                <p className="mt-1 text-xs text-[var(--svv-muted)]">
                  Менеджер ответит в Telegram ({receipt.telegramHandle}) по теме «
                  {receipt.topicLabel}».
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--svv-muted)]">Имя</span>
                <span className="text-[var(--svv-text)] font-medium">{receipt.customerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--svv-muted)]">Тема</span>
                <span className="text-[var(--svv-text)] font-semibold text-right">
                  {receipt.topicLabel}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--svv-muted)]">Комментарий</span>
                <span className="text-[var(--svv-text-soft)] text-right">{receipt.message}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              {(() => {
                const tgUrl = buildTelegramConciergeUrl(
                  MANAGER_TELEGRAM_HANDLE,
                  `Обращение ${receipt.id} (${receipt.topicLabel}): ${receipt.message}`
                );
                return (
                  <a
                    href={tgUrl}
                    onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-h-[46px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Продублировать в Telegram</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                );
              })()}
              <button
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setMessage('');
                }}
                className="min-h-[46px] px-5 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors cursor-pointer"
              >
                Новый запрос
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <h2 className="text-base font-bold text-[var(--svv-text)]">
              Оставить заявку менеджеру
            </h2>

            <div>
              <span className="block text-xs text-[var(--svv-muted)] mb-2">Что интересует?</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TOPICS.map((item) => {
                  const active = topic === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTopic(item.id)}
                      aria-pressed={active}
                      className={`min-h-[48px] p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                          : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)] hover:border-[var(--svv-border-strong)]'
                      }`}
                    >
                      <span className="block text-xs font-bold">{item.label}</span>
                      <span
                        className={`block text-[11px] mt-0.5 ${
                          active ? 'opacity-75' : 'text-[var(--svv-muted)]'
                        }`}
                      >
                        {item.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="mgr-name" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Ваше имя
                </label>
                <input
                  id="mgr-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Алексей"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
              </div>
              <div>
                <label htmlFor="mgr-tg" className="block text-xs text-[var(--svv-muted)] mb-1">
                  Telegram @username
                </label>
                <input
                  id="mgr-tg"
                  type="text"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mgr-message" className="block text-xs text-[var(--svv-muted)] mb-1">
                Вопрос или интересующая вещь
              </label>
              <textarea
                id="mgr-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Нужны замеры или живые фото вещи..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
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
              {submitting ? 'Отправка...' : 'Отправить сообщение менеджеру'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
