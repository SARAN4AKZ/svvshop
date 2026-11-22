import { useEffect } from 'react';
import { ExternalLink, FileText, ShieldCheck, X } from 'lucide-react';
import { CREATOR_TELEGRAM_HANDLE, MANAGER_TELEGRAM_HANDLE } from '../data/catalog';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

interface LicenseAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AGREEMENT_SECTIONS = [
  {
    title: '1. Общие положения и статус сервиса',
    paragraphs: [
      `Настоящее пользовательское и лицензионное соглашение регулирует порядок использования веб-приложения и Telegram Mini App «SVV SHOP», созданного и администрируемого автором ${CREATOR_TELEGRAM_HANDLE}.`,
      `Начиная работу с витриной, калькулятором выкупа из Китая, колесом призов или оформлением заказа, пользователь подтверждает полное и безоговорочное согласие со всеми пунктами настоящего документа.`,
      `Администрация магазина оставляет за собой право обновлять редакцию соглашения при расширении функционала сервиса без отдельного уведомления каждого посетителя.`,
    ],
  },
  {
    title: '2. Витрина, ассортимент и ценообразование',
    paragraphs: [
      `Все товары, фотографии, размерные сетки, составы материалов и цены в разделе «Каталог» публикуются и редактируются администратором витрины вручную.`,
      `Актуальное наличие конкретного размера, итоговая стоимость с учётом доставки и дополнительные живые фотографии подтверждаются официальным менеджером ${MANAGER_TELEGRAM_HANDLE} при обработке заказа.`,
      `Отображение товара в витрине носит информационный характер и не является публичной офертой до момента подтверждения заказа менеджером.`,
    ],
  },
  {
    title: '3. Индивидуальный выкуп из Китая',
    paragraphs: [
      `Через вкладку «Выкуп из Китая» пользователь может оформить индивидуальную заявку на поиск, выкуп, проверку на складе и доставку вещей по указанной ссылке или названию модели.`,
      `Калькулятор выкупа отображает ориентировочный расчёт в рублях по текущему внутреннему курсу CNY/RUB с учётом базовой проверки товара и выбранного тарифа логистики (Авиа 7–12 дней или Карго 16–24 дня).`,
      `Окончательная сумма фиксируется менеджером ${MANAGER_TELEGRAM_HANDLE} перед выкупом. После поступления вещи на склад клиенту направляется фотоотчёт по запросу.`,
    ],
  },
  {
    title: '4. Оформление заказа, оплата и доставка',
    paragraphs: [
      `При оформлении заказа в корзине пользователь самостоятельно выбирает способ доставки (курьер по Москве, СДЭК по России, международная отправка DHL или выдача в шоуруме SVV) и указывает точные контактные данные.`,
      `Оплата производится согласованным с менеджером способом после подтверждения наличия вещи, размера и адреса получателя.`,
      `Сроки доставки рассчитываются ориентировочно в рабочих днях с момента передачи отправления в службу доставки или отгрузки со склада выкупа.`,
    ],
  },
  {
    title: '5. Промокоды, клубные бонусы и колесо призов',
    paragraphs: [
      `Промокоды и бонусы, полученные в интерактивном «Колесе призов SVV» или предоставленные администрацией магазина, действуют согласно установленным условиям (минимальная сумма заказа, процентная или фиксированная скидка).`,
      `В одном заказе может быть применён только один промокод, если иное не согласовано менеджером индивидуально. Неденежные призы (стикерпак, приоритет выкупа) передаются при оформлении заказа или по обращению к ${MANAGER_TELEGRAM_HANDLE}.`,
    ],
  },
  {
    title: '6. Отмена заказа, возврат и проверка на брак',
    paragraphs: [
      `Отмена заказа из наличия возможна до момента передачи отправления в службу доставки. По позициям индивидуального выкупа из Китая отмена без удержания расходов возможна до момента оплаты выкупа у поставщика.`,
      `При обнаружении производственного брака на этапе складского фотоотчёта в Китае менеджер организует замену позиции или возврат согласованных средств до международной отправки.`,
    ],
  },
  {
    title: '7. Конфиденциальность и данные Telegram Mini App',
    paragraphs: [
      `Приложение запрашивает минимально необходимую информацию: имя получателя, Telegram @username, адрес доставки и комментарий к заказу.`,
      `Данные используются исключительно для обработки покупок, отправки фотоотчётов и связи со стороны официального менеджера ${MANAGER_TELEGRAM_HANDLE}. Передача персональных сведений сторонним рекламным сетям не осуществляется.`,
      `Локальное хранилище браузера или WebView Telegram применяется только для сохранения корзины, списка избранного и выбранной темы оформления.`,
    ],
  },
  {
    title: '8. Интеллектуальная собственность и авторские права',
    paragraphs: [
      `Исключительные права на дизайн интерфейса, визуальную концепцию, структуру разделов, программный код и фирменное оформление «SVV SHOP» принадлежат создателю проекта ${CREATOR_TELEGRAM_HANDLE}.`,
      `Полное или частичное копирование, перепродажа шаблона, клонирование интерфейса или публикация материалов сервиса от своего имени без письменного разрешения ${CREATOR_TELEGRAM_HANDLE} запрещены.`,
    ],
  },
  {
    title: '9. Ограничение ответственности',
    paragraphs: [
      `Сервис не несёт ответственности за задержки сроков доставки, вызванные работой сторонних логистических операторов, таможенных органов, погодными условиями или предоставлением пользователем некорректного Telegram @username / адреса доставки.`,
      `Остерегайтесь мошенников: официальная связь с покупателями ведётся исключительно через аккаунт менеджера ${MANAGER_TELEGRAM_HANDLE} и создателя ${CREATOR_TELEGRAM_HANDLE}.`,
    ],
  },
  {
    title: '10. Контакты правообладателя и поддержки',
    paragraphs: [
      `По вопросам авторских прав, сотрудничества и технической работы мини-приложения обращайтесь к создателю: ${CREATOR_TELEGRAM_HANDLE}.`,
      `По вопросам заказов, замеров, фотоотчётов и выкупа из Китая обращайтесь к менеджеру: ${MANAGER_TELEGRAM_HANDLE}.`,
    ],
  },
];

export function LicenseAgreementModal({ isOpen, onClose }: LicenseAgreementModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 backdrop-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] bg-[var(--svv-surface)] text-[var(--svv-text)] rounded-t-3xl sm:rounded-2xl border border-[var(--svv-border)] shadow-2xl flex flex-col modal-pop-responsive overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-[var(--svv-border-strong)] rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="px-5 py-4 border-b border-[var(--svv-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border)] flex items-center justify-center text-[var(--svv-accent)]">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                SVV † SHOP · LEGAL AGREEMENT
              </p>
              <h2 id="license-modal-title" className="font-display text-base sm:text-lg font-bold text-[var(--svv-text)]">
                Лицензионное и пользовательское соглашение
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть лицензионное соглашение"
            className="min-h-[38px] min-w-[38px] rounded-full bg-[var(--svv-surface-2)] text-[var(--svv-text)] hover:opacity-80 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-[var(--svv-text-soft)] leading-relaxed">
          {/* Creator & Manager Attribution Box */}
          <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border-strong)] space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
              <ShieldCheck className="w-4 h-4 text-[var(--svv-accent)]" />
              <span>Создатель, правообладатель и официальный менеджер</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[var(--svv-text)]">
                  Создатель проекта: {CREATOR_TELEGRAM_HANDLE}
                </p>
                <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                  Менеджер по заказам, замерам и выкупу: {MANAGER_TELEGRAM_HANDLE}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const creatorUrl = buildTelegramConciergeUrl(
                    CREATOR_TELEGRAM_HANDLE,
                    'Здравствуйте! Пишу по поводу лицензии / SVV SHOP.'
                  );
                  const managerUrl = buildTelegramConciergeUrl(
                    MANAGER_TELEGRAM_HANDLE,
                    'Здравствуйте! Вопрос по заказу в SVV SHOP.'
                  );
                  return (
                    <>
                      <a
                        href={creatorUrl}
                        onClick={(e) => handleTelegramLinkClick(e, creatorUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[36px] px-3.5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-[11px] font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center gap-1.5"
                      >
                        <span>{CREATOR_TELEGRAM_HANDLE}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={managerUrl}
                        onClick={(e) => handleTelegramLinkClick(e, managerUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[36px] px-3.5 rounded-full border border-[var(--svv-border-strong)] text-[var(--svv-text)] text-[11px] font-semibold hover:bg-[var(--svv-surface-2)] press-spring inline-flex items-center gap-1.5"
                      >
                        <span>{MANAGER_TELEGRAM_HANDLE}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {AGREEMENT_SECTIONS.map((section) => (
              <div
                key={section.title}
                className="pb-4 border-b border-[var(--svv-border)]/70 last:border-b-0 last:pb-0 space-y-2"
              >
                <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-[var(--svv-text)]">
                  {section.title}
                </h3>
                {section.paragraphs.map((paragraph, idx) => (
                  <p key={idx} className="text-[var(--svv-muted)] leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--svv-border)] bg-[var(--svv-surface-2)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] font-mono text-[var(--svv-muted)]">
            Создатель: {CREATOR_TELEGRAM_HANDLE} · Менеджер: {MANAGER_TELEGRAM_HANDLE}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
          >
            Принимаю условия
          </button>
        </div>
      </div>
    </div>
  );
}
