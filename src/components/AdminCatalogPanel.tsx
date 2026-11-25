import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Bell,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  CATEGORIES,
  MANAGER_TELEGRAM_HANDLE,
  type HeroBannerConfig,
  type LuxuryProduct,
  type PrizeWheelConfig,
  type PromoCodeItem,
} from '../data/catalog';
import {
  countNewAdminRequests,
  createSafeProductId,
  formatCny,
  formatRequestTimestamp,
  formatRub,
  getNextRequestStatus,
  getRequestStatusLabel,
  isSafeExternalWebUrl,
  parseSizesRaw,
  validateAdminProductInput,
  validatePasswordChangeInput,
  type InboxSummary,
  type RequestStatus,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';
import { AdminBannerEditor } from './AdminBannerEditor';
import { AdminPromoManager } from './AdminPromoManager';
import { AdminTrackingManager, type TrackingDraft } from './AdminTrackingManager';
import { AdminWheelEditor } from './AdminWheelEditor';

type AdminSubTab = 'catalog' | 'banner' | 'promos' | 'wheel' | 'inbox' | 'tracking' | 'security';
type InboxType = 'orders' | 'buyouts' | 'inquiries';

export interface ServerOrderEntry {
  id: string;
  createdAt: string;
  status: RequestStatus;
  customerName: string;
  telegramHandle: string;
  deliveryTitle: string;
  deliveryAddress: string;
  deliveryPrice: number;
  paymentMethod: 'concierge' | 'invoice';
  promoCode?: string;
  discountAmount: number;
  subtotalAmount: number;
  totalAmount: number;
  items: Array<{
    productId: string;
    brand: string;
    name: string;
    size: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface ServerBuyoutEntry {
  id: string;
  createdAt: string;
  status?: RequestStatus;
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
  notes: string;
}

export interface ServerManagerInquiry {
  id: string;
  createdAt: string;
  status?: RequestStatus;
  customerName: string;
  telegramHandle: string;
  topicLabel: string;
  message: string;
}

interface AdminCatalogPanelProps {
  products: LuxuryProduct[];
  heroBanner: HeroBannerConfig;
  adminPromos: PromoCodeItem[];
  prizeWheel: PrizeWheelConfig;
  inboxSummary?: InboxSummary;
  userEmail: string | null;
  isCloudAdmin: boolean;
  cloudAuthError?: string | null;
  localOnlyProductCount?: number;
  adminBearerToken: string | null;
  authMode: 'env' | 'claimed' | 'unclaimed';
  authBusy: boolean;
  onInboxChanged?: () => void;
  onPasswordClaimOrLogin: (password: string, isClaim: boolean) => Promise<void>;
  onChangeAdminPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ envConfigured?: boolean }>;
  onLockPasswordSession: () => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onSyncLocalToCloud?: () => Promise<void>;
  onSaveProduct: (product: LuxuryProduct, isNew: boolean) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSaveBanner: (banner: HeroBannerConfig) => Promise<void>;
  onCreatePromo: (promo: PromoCodeItem) => Promise<void>;
  onTogglePromo: (code: string, nextActive: boolean) => Promise<void>;
  onDeletePromo: (code: string) => Promise<void>;
  onSaveWheel: (wheel: PrizeWheelConfig) => Promise<void>;
}

const EMPTY_FORM = {
  brand: '',
  category: 'Худи и свитшоты' as LuxuryProduct['category'],
  name: '',
  priceRaw: '',
  availability: 'В наличии',
  imageUrl: '',
  sizesRaw: 'S, M, L',
  composition: '100% плотный хлопок',
  origin: 'Италия',
  stylistNote: '',
  pairingTip: '',
};

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

export function AdminCatalogPanel({
  products,
  heroBanner,
  adminPromos,
  prizeWheel,
  inboxSummary,
  userEmail,
  isCloudAdmin,
  cloudAuthError = null,
  localOnlyProductCount = 0,
  adminBearerToken,
  authMode,
  authBusy,
  onInboxChanged,
  onPasswordClaimOrLogin,
  onChangeAdminPassword,
  onLockPasswordSession,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncLocalToCloud,
  onSaveProduct,
  onDeleteProduct,
  onSaveBanner,
  onCreatePromo,
  onTogglePromo,
  onDeletePromo,
  onSaveWheel,
}: AdminCatalogPanelProps) {
  const [syncingToCloud, setSyncingToCloud] = useState(false);
  const [adminTab, setAdminTab] = useState<AdminSubTab>('catalog');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showChangeCurrent, setShowChangeCurrent] = useState(false);
  const [showChangeNew, setShowChangeNew] = useState(false);
  const [changePassErrors, setChangePassErrors] = useState<string[]>([]);
  const [changePassBusy, setChangePassBusy] = useState(false);
  const [changePassNotice, setChangePassNotice] = useState<string | null>(null);

  const [ordersInbox, setOrdersInbox] = useState<ServerOrderEntry[]>([]);
  const [buyoutInbox, setBuyoutInbox] = useState<ServerBuyoutEntry[]>([]);
  const [inquiryInbox, setInquiryInbox] = useState<ServerManagerInquiry[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'all' | RequestStatus>('all');
  const [inboxLoading, setInboxLoading] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const canEdit = isCloudAdmin || Boolean(adminBearerToken);

  const loadInbox = useCallback(
    async (token: string) => {
      setInboxLoading(true);
      try {
        const res = await fetch('/api/inbox', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          orders?: ServerOrderEntry[];
          buyouts?: ServerBuyoutEntry[];
          inquiries?: ServerManagerInquiry[];
        };
        if (Array.isArray(data.orders)) setOrdersInbox(data.orders);
        if (Array.isArray(data.buyouts)) setBuyoutInbox(data.buyouts);
        if (Array.isArray(data.inquiries)) setInquiryInbox(data.inquiries);
        onInboxChanged?.();
      } catch {
        // Ignore network errors
      } finally {
        setInboxLoading(false);
      }
    },
    [onInboxChanged]
  );

  useEffect(() => {
    if (!adminBearerToken) {
      setOrdersInbox([]);
      setBuyoutInbox([]);
      setInquiryInbox([]);
      return;
    }
    void loadInbox(adminBearerToken);
    const interval = window.setInterval(() => {
      void loadInbox(adminBearerToken);
    }, 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [adminBearerToken, loadInbox]);

  useEffect(() => {
    if (adminBearerToken && adminTab === 'inbox') {
      void loadInbox(adminBearerToken);
    }
  }, [adminBearerToken, adminTab, loadInbox]);

  const handleCycleInboxStatus = async (
    type: InboxType,
    id: string,
    currentStatus?: RequestStatus
  ) => {
    if (!adminBearerToken) return;
    const nextStatus = getNextRequestStatus(currentStatus);
    try {
      const res = await fetch(`/api/inbox/${type}/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) return;
      if (type === 'orders') {
        setOrdersInbox((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
        );
      } else if (type === 'buyouts') {
        setBuyoutInbox((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
        );
      } else {
        setInquiryInbox((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
        );
      }
      onInboxChanged?.();
    } catch {
      // Ignore network errors
    }
  };

  const handleDeleteInboxItem = async (type: InboxType, id: string) => {
    if (!adminBearerToken) return;
    try {
      const res = await fetch(`/api/inbox/${type}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminBearerToken}` },
      });
      if (!res.ok) return;
      if (type === 'orders') {
        setOrdersInbox((prev) => prev.filter((item) => item.id !== id));
      } else if (type === 'buyouts') {
        setBuyoutInbox((prev) => prev.filter((item) => item.id !== id));
      } else {
        setInquiryInbox((prev) => prev.filter((item) => item.id !== id));
      }
      onInboxChanged?.();
    } catch {
      // Ignore network errors
    }
  };

  const totalInboxCount = ordersInbox.length + buyoutInbox.length + inquiryInbox.length;
  const newInboxCount = countNewAdminRequests([
    ...ordersInbox,
    ...buyoutInbox,
    ...inquiryInbox,
  ]);
  const summaryTotalNew = inboxSummary?.newTotalCount ?? 0;
  const summaryOrdersNew = inboxSummary?.newOrdersCount ?? 0;
  const effectiveNewCount = adminBearerToken ? newInboxCount : summaryTotalNew;

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setPasswordError('Введите пароль администратора.');
      return;
    }
    if (authMode === 'unclaimed' && trimmed.length < 4) {
      setPasswordError('Пароль должен содержать минимум 4 символа.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await onPasswordClaimOrLogin(trimmed, authMode === 'unclaimed');
      setPasswordInput('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Ошибка входа.');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleChangePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validatePasswordChangeInput({
      currentPassword: currentPassInput,
      newPassword: newPassInput,
      confirmPassword: confirmPassInput,
    });
    if (errs.length > 0) {
      setChangePassErrors(errs);
      setChangePassNotice(null);
      return;
    }
    setChangePassBusy(true);
    setChangePassErrors([]);
    setChangePassNotice(null);
    try {
      const result = await onChangeAdminPassword(currentPassInput.trim(), newPassInput.trim());
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setChangePassNotice(
        result.envConfigured
          ? 'Пароль изменён для текущей и последующих сессий. Если вы задавали SVV_ADMIN_PASSCODE в Secrets, обновите его и там при необходимости.'
          : 'Пароль администратора успешно обновлён, все старые сессии сброшены.'
      );
    } catch (err) {
      setChangePassErrors([err instanceof Error ? err.message : 'Не удалось изменить пароль.']);
    } finally {
      setChangePassBusy(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors([]);
    setUploadError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: LuxuryProduct) => {
    setEditingId(item.id);
    setForm({
      brand: item.brand,
      category: item.category,
      name: item.name,
      priceRaw: String(item.price),
      availability: item.availability,
      imageUrl: item.imageUrl,
      sizesRaw: item.sizes.join(', '),
      composition: item.composition,
      origin: item.origin,
      stylistNote: item.stylistNote,
      pairingTip: item.pairingTip,
    });
    setErrors([]);
    setUploadError(null);
    setIsFormOpen(true);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  const handlePhotoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!adminBearerToken) {
      setUploadError('Для загрузки файлов на сервер войдите по паролю администратора.');
      return;
    }
    setUploadError(null);
    setUploadingPhoto(true);
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
        throw new Error(data.error || 'Не удалось загрузить фото.');
      }
      setForm((f) => ({ ...f, imageUrl: data.url! }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Ошибка загрузки фото.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(form.priceRaw.replace(/\s+/g, ''));
    const validationErrors = validateAdminProductInput({
      id: editingId ?? undefined,
      brand: form.brand,
      category: form.category,
      name: form.name,
      price: numericPrice,
      availability: form.availability,
      imageUrl: form.imageUrl,
      sizesRaw: form.sizesRaw,
      composition: form.composition,
      origin: form.origin,
      stylistNote: form.stylistNote,
      pairingTip: form.pairingTip,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const isNew = !editingId;
    const product: LuxuryProduct = {
      id: editingId ?? createSafeProductId(form.brand),
      brand: form.brand.trim(),
      category: form.category,
      name: form.name.trim(),
      price: Math.round(numericPrice),
      availability: form.availability.trim() || 'В наличии',
      imageUrl: form.imageUrl.trim(),
      sizes: parseSizesRaw(form.sizesRaw),
      composition: form.composition.trim(),
      origin: form.origin.trim() || 'Италия',
      stylistNote: form.stylistNote.trim() || 'Позиция из каталога SVV SHOP.',
      pairingTip: form.pairingTip.trim(),
      order: isNew
        ? products.length + 1
        : products.find((p) => p.id === editingId)?.order ?? 100,
    };

    setSaving(true);
    try {
      await onSaveProduct(product, isNew);
      setIsFormOpen(false);
      setEditingId(null);
      setErrors([]);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Не удалось сохранить вещь.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="py-5 sm:py-8 px-4 sm:px-0 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
            SVV † ADMIN STUDIO · {MANAGER_TELEGRAM_HANDLE}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-black uppercase text-[var(--svv-text)] tracking-tight">
            Управление магазином
          </h1>
        </div>

        {canEdit && adminTab === 'catalog' && (
          <button
            type="button"
            onClick={openAddForm}
            className="min-h-[44px] px-5 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить вещь</span>
          </button>
        )}
      </div>

      {/* New Orders / Requests Notification Banner (counts only, no PII exposed) */}
      {effectiveNewCount > 0 && (
        <div
          role="status"
          className="p-3.5 sm:p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-notify)]/55 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-9 h-9 rounded-full bg-[var(--svv-notify)] text-[var(--svv-notify-fg)] flex items-center justify-center shrink-0">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[var(--svv-notify)] animate-ping opacity-35"
              />
              <Bell className="relative w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-[var(--svv-text)]">
                {summaryOrdersNew > 0
                  ? `Новые заказы: ${summaryOrdersNew} · всего новых заявок: ${effectiveNewCount}`
                  : `Поступили новые заявки: ${effectiveNewCount}`}
              </p>
              <p className="text-[11px] text-[var(--svv-muted)]">
                {adminBearerToken
                  ? 'Откройте вкладку «Заявки», чтобы обработать обращения и сменить статус.'
                  : 'Войдите по паролю администратора, чтобы просмотреть детали и ответить клиенту.'}
              </p>
            </div>
          </div>

          {adminBearerToken && adminTab !== 'inbox' && (
            <button
              type="button"
              onClick={() => setAdminTab('inbox')}
              className="min-h-[38px] px-4 rounded-full bg-[var(--svv-notify)] text-[var(--svv-notify-fg)] text-xs font-bold press-spring cursor-pointer shrink-0"
            >
              Открыть заявки ({effectiveNewCount})
            </button>
          )}
        </div>
      )}

      {/* Password Auth Gate or Active Session Bar */}
      {!canEdit ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form
            onSubmit={handlePasswordSubmit}
            noValidate
            className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3.5"
          >
            <div className="flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-[var(--svv-text)]">
                  {authMode === 'unclaimed'
                    ? 'Активация пароля администратора'
                    : 'Вход по паролю администратора'}
                </h2>
                <p className="text-xs text-[var(--svv-muted)] mt-0.5">
                  {authMode === 'unclaimed'
                    ? 'Задайте пароль от 4 символов для этой сессии сервера. Для постоянного пароля на Railway добавьте SVV_ADMIN_PASSCODE в Variables.'
                    : authMode === 'env'
                    ? 'Введите пароль из переменной окружения SVV_ADMIN_PASSCODE.'
                    : 'Введите активированный пароль (или значение SVV_ADMIN_PASSCODE из переменных сервера).'}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="admin-password-input" className="block text-xs text-[var(--svv-muted)] mb-1">
                Пароль администратора
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Введите пароль"
                  autoComplete="current-password"
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <p role="alert" className="text-xs text-[var(--svv-danger-fg)]">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={passwordBusy}
              className="w-full min-h-[44px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors cursor-pointer"
            >
              {passwordBusy
                ? 'Проверка...'
                : authMode === 'unclaimed'
                ? 'Активировать пароль и войти'
                : 'Войти в админку'}
            </button>
          </form>

          <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-[var(--svv-text)]">
                {userEmail
                  ? `Аккаунт ${userEmail} не является владельцем`
                  : 'Облачная синхронизация (Google)'}
              </h2>
              <p className="text-xs text-[var(--svv-muted)] leading-relaxed">
                Войдите через Google-аккаунт владельца, чтобы вещи, баннер, промокоды и колесо
                призов сохранялись в облаке Firestore и отображались везде (AI Studio, Railway,
                Telegram).
              </p>
              {cloudAuthError && (
                <p role="alert" className="text-xs text-[var(--svv-danger-fg)]">
                  {cloudAuthError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onSignInGoogle}
              disabled={authBusy}
              className="w-full min-h-[44px] px-4 rounded-full border border-[var(--svv-border-strong)] text-[var(--svv-text)] text-xs font-semibold hover:bg-[var(--svv-surface-2)] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authBusy ? 'Вход...' : 'Войти через Google'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--svv-text)]">
                {isCloudAdmin
                  ? `Облако Firestore активно (${userEmail})`
                  : 'Локальный режим сервера (без Google-облака)'}
              </p>
              <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                {isCloudAdmin
                  ? 'Вещи, баннер, промокоды и колесо призов сохраняются в облаке и видны всем пользователям на всех устройствах.'
                  : 'Сейчас изменения сохраняются только в текущем контейнере. Подключите Google-облако, чтобы вещи отображались везде.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isCloudAdmin && (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  disabled={authBusy}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{authBusy ? 'Вход...' : 'Подключить Google-облако'}</span>
                </button>
              )}
              {isCloudAdmin && localOnlyProductCount > 0 && onSyncLocalToCloud && (
                <button
                  type="button"
                  disabled={syncingToCloud}
                  onClick={() => {
                    setSyncingToCloud(true);
                    void onSyncLocalToCloud().finally(() => setSyncingToCloud(false));
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingToCloud ? 'animate-spin' : ''}`} />
                  <span>
                    {syncingToCloud
                      ? 'Перенос...'
                      : `Перенести в облако (${localOnlyProductCount})`}
                  </span>
                </button>
              )}
              {adminBearerToken && (
                <button
                  type="button"
                  onClick={onLockPasswordSession}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Заблокировать</span>
                </button>
              )}
              {isCloudAdmin && (
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти Google</span>
                </button>
              )}
            </div>
          </div>

          {cloudAuthError && (
            <p role="alert" className="text-xs text-[var(--svv-danger-fg)]">
              {cloudAuthError}
            </p>
          )}
        </div>
      )}

      {/* Admin Sub-Tabs */}
      {canEdit && (
        <div
          role="tablist"
          aria-label="Разделы админ-панели"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
        >
          {(
            [
              { id: 'catalog', label: `Вещи (${products.length})` },
              { id: 'banner', label: 'Баннер' },
              { id: 'promos', label: `Промокоды (${adminPromos.length})` },
              { id: 'wheel', label: `Колесо призов (${prizeWheel.segments.length})` },
              {
                id: 'inbox',
                label:
                  newInboxCount > 0
                    ? `Заявки (${totalInboxCount}) · +${newInboxCount}`
                    : `Заявки (${totalInboxCount})`,
              },
              { id: 'tracking', label: 'Трекинг' },
              { id: 'security', label: 'Пароль' },
            ] as const
          ).map((tab) => {
            const active = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAdminTab(tab.id)}
                className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 press-spring cursor-pointer inline-flex items-center gap-1.5 ${
                  active
                    ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)]'
                    : 'bg-[var(--svv-surface)] border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'inbox' && newInboxCount > 0 && !active && (
                  <span className="w-2 h-2 rounded-full bg-[var(--svv-notify)]" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add / Edit Form */}
      {canEdit && adminTab === 'catalog' && isFormOpen && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="p-5 sm:p-6 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border-strong)] space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--svv-text)]">
              {editingId ? 'Редактировать вещь' : 'Добавить новую вещь'}
            </h2>
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
              <label htmlFor="admin-brand" className="block text-xs text-[var(--svv-muted)] mb-1">
                Бренд
              </label>
              <input
                id="admin-brand"
                type="text"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                placeholder="Укажите бренд"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>

            <div>
              <label htmlFor="admin-category" className="block text-xs text-[var(--svv-muted)] mb-1">
                Категория
              </label>
              <select
                id="admin-category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value as LuxuryProduct['category'],
                  }))
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              >
                {CATEGORIES.filter((c): c is LuxuryProduct['category'] => c !== 'Все').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label htmlFor="admin-name" className="block text-xs text-[var(--svv-muted)] mb-1">
                Название вещи
              </label>
              <input
                id="admin-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Например, Бомбер Flight Dark"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>

            <div>
              <label htmlFor="admin-price" className="block text-xs text-[var(--svv-muted)] mb-1">
                Цена (₽)
              </label>
              <input
                id="admin-price"
                type="number"
                value={form.priceRaw}
                onChange={(e) => setForm((f) => ({ ...f, priceRaw: e.target.value }))}
                placeholder="165000"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] tabular-nums focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="admin-sizes" className="block text-xs text-[var(--svv-muted)] mb-1">
                Размеры через запятую
              </label>
              <input
                id="admin-sizes"
                type="text"
                value={form.sizesRaw}
                onChange={(e) => setForm((f) => ({ ...f, sizesRaw: e.target.value }))}
                placeholder="S, M, L"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
            <div>
              <label htmlFor="admin-availability" className="block text-xs text-[var(--svv-muted)] mb-1">
                Наличие / статус
              </label>
              <input
                id="admin-availability"
                type="text"
                value={form.availability}
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                placeholder="В наличии"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="admin-composition" className="block text-xs text-[var(--svv-muted)] mb-1">
                Материал / состав
              </label>
              <input
                id="admin-composition"
                type="text"
                value={form.composition}
                onChange={(e) => setForm((f) => ({ ...f, composition: e.target.value }))}
                placeholder="100% плотный хлопок"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
            <div>
              <label htmlFor="admin-origin" className="block text-xs text-[var(--svv-muted)] mb-1">
                Страна производства
              </label>
              <input
                id="admin-origin"
                type="text"
                value={form.origin}
                onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                placeholder="Италия"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
              />
            </div>
          </div>

          {/* Photo Controls: Preview + Upload + Direct URL */}
          <div className="p-4 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-3">
            <p className="text-xs font-semibold text-[var(--svv-text)]">Реальное фото вещи</p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-24 aspect-[3/4] rounded-xl overflow-hidden bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0 flex items-center justify-center text-[10px] text-[var(--svv-muted)] text-center p-2">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt="Превью товара"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Нет фото</span>
                )}
              </div>

              <div className="flex-1 w-full space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handlePhotoFileChange(e)}
                    className="hidden"
                    id="admin-photo-file"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>{uploadingPhoto ? 'Загрузка...' : 'Загрузить фото с устройства'}</span>
                  </button>
                </div>

                <div>
                  <label htmlFor="admin-image-url" className="block text-[11px] text-[var(--svv-muted)] mb-1">
                    Или вставьте прямую ссылку на фото (https://... или /uploads/...)
                  </label>
                  <input
                    id="admin-image-url"
                    type="text"
                    value={form.imageUrl}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                  <p className="text-[10px] text-[var(--svv-muted)] mt-1">
                    Для показа на всех устройствах и после перезапуска используйте ссылку https://...; локальный файл хранится только на текущем сервере.
                  </p>
                </div>

                {uploadError && (
                  <p role="alert" className="text-xs text-[var(--svv-danger-fg)]">
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="admin-note" className="block text-xs text-[var(--svv-muted)] mb-1">
              Описание вещи
            </label>
            <textarea
              id="admin-note"
              rows={2}
              value={form.stylistNote}
              onChange={(e) => setForm((f) => ({ ...f, stylistNote: e.target.value }))}
              placeholder="Детали кроя, посадки, состояния, бирок..."
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
            />
          </div>

          <div>
            <label htmlFor="admin-pairing" className="block text-xs text-[var(--svv-muted)] mb-1">
              С чем сочетать (необязательно)
            </label>
            <input
              id="admin-pairing"
              type="text"
              value={form.pairingTip}
              onChange={(e) => setForm((f) => ({ ...f, pairingTip: e.target.value }))}
              placeholder="Например, с широкими карго и раннерами"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
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

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="min-h-[44px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors cursor-pointer"
            >
              {saving ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить в витрину'}
            </button>
          </div>
        </form>
      )}

      {/* Hero Banner Editor Sub-Tab */}
      {canEdit && adminTab === 'banner' && (
        <div key="admin-banner" className="tab-view-enter space-y-4">
          <AdminBannerEditor
            bannerConfig={heroBanner}
            adminBearerToken={adminBearerToken}
            onSaveBanner={onSaveBanner}
          />
        </div>
      )}

      {/* Security / Change Admin Password Sub-Tab */}
      {canEdit && adminTab === 'security' && (
        <div key="admin-security" className="tab-view-enter space-y-4">
          {!adminBearerToken ? (
            <div className="p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs text-[var(--svv-muted)]">
              Для смены пароля администратора выполните вход по текущему паролю.
            </div>
          ) : (
            <form
              onSubmit={handleChangePasswordSubmit}
              noValidate
              className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-4 max-w-lg"
            >
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--svv-text)]">
                    Смена пароля администратора
                  </h2>
                  <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                    После смены пароля все предыдущие сессии автоматически сбрасываются, а ваша
                    текущая сессия обновляется.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="change-current-pass"
                  className="block text-xs text-[var(--svv-muted)] mb-1"
                >
                  Текущий пароль
                </label>
                <div className="relative">
                  <input
                    id="change-current-pass"
                    type={showChangeCurrent ? 'text' : 'password'}
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Введите текущий пароль"
                    className="w-full min-h-[42px] pl-3.5 pr-11 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeCurrent((v) => !v)}
                    aria-label={showChangeCurrent ? 'Скрыть текущий пароль' : 'Показать текущий пароль'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
                  >
                    {showChangeCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="change-new-pass"
                  className="block text-xs text-[var(--svv-muted)] mb-1"
                >
                  Новый пароль (от 4 символов)
                </label>
                <div className="relative">
                  <input
                    id="change-new-pass"
                    type={showChangeNew ? 'text' : 'password'}
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Введите новый пароль"
                    className="w-full min-h-[42px] pl-3.5 pr-11 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowChangeNew((v) => !v)}
                    aria-label={showChangeNew ? 'Скрыть новый пароль' : 'Показать новый пароль'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
                  >
                    {showChangeNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="change-confirm-pass"
                  className="block text-xs text-[var(--svv-muted)] mb-1"
                >
                  Повторите новый пароль
                </label>
                <input
                  id="change-confirm-pass"
                  type={showChangeNew ? 'text' : 'password'}
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Повторите новый пароль"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                />
              </div>

              {changePassErrors.length > 0 && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-[var(--svv-danger-bg)] border border-[var(--svv-danger-border)] text-xs text-[var(--svv-danger-fg)] space-y-1"
                >
                  {changePassErrors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              )}

              {changePassNotice && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] text-xs text-[var(--svv-text)]"
                >
                  {changePassNotice}
                </div>
              )}

              <button
                type="submit"
                disabled={changePassBusy}
                className="min-h-[44px] px-6 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
              >
                {changePassBusy ? 'Обновление...' : 'Обновить пароль'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Promo Codes Sub-Tab */}
      {canEdit && adminTab === 'promos' && (
        <div key="admin-promos" className="tab-view-enter space-y-4">
          <AdminPromoManager
            promos={adminPromos}
            onCreatePromo={onCreatePromo}
            onTogglePromo={onTogglePromo}
            onDeletePromo={onDeletePromo}
          />
        </div>
      )}

      {/* Prize Wheel Editor Sub-Tab */}
      {canEdit && adminTab === 'wheel' && (
        <div key="admin-wheel" className="tab-view-enter space-y-4">
          <AdminWheelEditor
            wheelConfig={prizeWheel}
            promos={adminPromos}
            onSaveWheel={onSaveWheel}
          />
        </div>
      )}

      {/* Tracking Manager Sub-Tab */}
      {canEdit && adminTab === 'tracking' && (
        <div key="admin-tracking" className="tab-view-enter space-y-4">
          {!adminBearerToken ? (
            <div className="p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs text-[var(--svv-muted)]">
              Для управления трекингом отправлений выполните вход по паролю администратора.
            </div>
          ) : (
            <AdminTrackingManager
              adminBearerToken={adminBearerToken}
              prefillDraft={trackingDraft}
              onConsumePrefill={() => setTrackingDraft(null)}
            />
          )}
        </div>
      )}

      {/* Orders, Buyouts & Inquiries Inbox Sub-Tab */}
      {canEdit && adminTab === 'inbox' && (
        <div key="admin-inbox" className="tab-view-enter space-y-4">
          {!adminBearerToken ? (
            <div className="p-4 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-xs text-[var(--svv-muted)]">
              Для просмотра и обработки входящих заявок выполните вход по паролю администратора.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)]">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'all', label: `Все (${totalInboxCount})` },
                      { id: 'new', label: `Новые (${newInboxCount})` },
                      { id: 'in_progress', label: 'В работе' },
                      { id: 'done', label: 'Закрыты' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setInboxFilter(f.id)}
                      className={`min-h-[34px] px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                        inboxFilter === f.id
                          ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)]'
                          : 'bg-[var(--svv-input)] border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void loadInbox(adminBearerToken)}
                  disabled={inboxLoading}
                  className="min-h-[34px] px-3.5 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] press-spring inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inboxLoading ? 'animate-spin' : ''}`} />
                  <span>{inboxLoading ? 'Обновление...' : 'Обновить'}</span>
                </button>
              </div>

              {(() => {
                const matchFilter = (status?: RequestStatus) => {
                  const normalized = status ?? 'new';
                  return inboxFilter === 'all' || normalized === inboxFilter;
                };
                const visibleOrders = ordersInbox.filter((o) => matchFilter(o.status));
                const visibleBuyouts = buyoutInbox.filter((b) => matchFilter(b.status));
                const visibleInquiries = inquiryInbox.filter((i) => matchFilter(i.status));
                const hasAnyVisible =
                  visibleOrders.length + visibleBuyouts.length + visibleInquiries.length > 0;

                if (!hasAnyVisible) {
                  return (
                    <div className="p-8 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] text-center space-y-1.5">
                      <p className="text-sm font-semibold text-[var(--svv-text)]">
                        {totalInboxCount === 0
                          ? 'Входящих заявок пока нет'
                          : 'Нет заявок с выбранным статусом'}
                      </p>
                      <p className="text-xs text-[var(--svv-muted)]">
                        Сюда автоматически приходят заказы из корзины, заявки на выкуп из Китая и
                        обращения к менеджеру {MANAGER_TELEGRAM_HANDLE}.
                      </p>
                    </div>
                  );
                }

                const statusBadgeClass = (status?: RequestStatus) => {
                  if (status === 'in_progress') {
                    return 'bg-[var(--svv-notify)]/20 border-[var(--svv-notify)]/60 text-[var(--svv-text)]';
                  }
                  if (status === 'done') {
                    return 'bg-[var(--svv-surface-2)] border-[var(--svv-border)] text-[var(--svv-muted)]';
                  }
                  return 'bg-[var(--svv-accent)] border-[var(--svv-accent)] text-[var(--svv-accent-fg)]';
                };

                return (
                  <div className="space-y-4">
                    {visibleOrders.length > 0 && (
                      <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--svv-accent)]">
                          <ShoppingBag className="w-4 h-4" />
                          <span>Заказы из корзины ({visibleOrders.length})</span>
                        </div>
                        <div className="divide-y divide-[var(--svv-border)]">
                          {visibleOrders.map((ord) => (
                            <div key={ord.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5 text-xs">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-[var(--svv-text)]">
                                    {ord.id} · {ord.customerName} ({ord.telegramHandle})
                                  </p>
                                  <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                                    {formatRequestTimestamp(ord.createdAt)} · {ord.deliveryTitle} ·{' '}
                                    {ord.deliveryAddress}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 tabular-nums">
                                  <p className="font-bold text-[var(--svv-accent)] text-sm">
                                    {formatRub(ord.totalAmount)}
                                  </p>
                                  {ord.promoCode && (
                                    <p className="text-[10px] text-[var(--svv-muted)]">
                                      Код {ord.promoCode} (−{formatRub(ord.discountAmount)})
                                    </p>
                                  )}
                                </div>
                              </div>

                              <ul className="p-2.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] space-y-1 text-[11px] text-[var(--svv-text-soft)]">
                                {ord.items.map((it, idx) => (
                                  <li key={`${ord.id}-${idx}`} className="flex justify-between gap-2">
                                    <span className="truncate">
                                      {it.brand} · {it.name} ({it.size}) × {it.quantity}
                                    </span>
                                    <span className="tabular-nums shrink-0 text-[var(--svv-accent)]">
                                      {formatRub(it.unitPrice * it.quantity)}
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleCycleInboxStatus('orders', ord.id, ord.status)}
                                    className={`min-h-[32px] px-3 rounded-full border text-[11px] font-bold cursor-pointer press-spring ${statusBadgeClass(
                                      ord.status
                                    )}`}
                                  >
                                    {getRequestStatusLabel(ord.status)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTrackingDraft({
                                        orderCode: ord.id,
                                        telegramHandle: ord.telegramHandle,
                                        itemTitle:
                                          ord.items.length === 1
                                            ? `${ord.items[0].brand} · ${ord.items[0].name} (${ord.items[0].size})`
                                            : `${ord.items[0]?.brand ?? 'SVV'} (+ ещё ${ord.items.length - 1})`,
                                        stage: 'confirmed',
                                        carrierTrack: '',
                                        deliveryMethod: ord.deliveryTitle,
                                        etaLabel: '',
                                        locationNote: 'Ожидает отправки со склада SVV.',
                                      });
                                      setAdminTab('tracking');
                                    }}
                                    className="min-h-[32px] px-3 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>В трекинг</span>
                                  </button>
                                  {(() => {
                                    const tgUrl = buildTelegramConciergeUrl(
                                      ord.telegramHandle,
                                      `Здравствуйте, ${ord.customerName}! По вашему заказу ${ord.id} в SVV SHOP:`
                                    );
                                    return (
                                      <a
                                        href={tgUrl}
                                        onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-h-[32px] px-3 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1"
                                      >
                                        <span>Ответить в TG</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    );
                                  })()}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteInboxItem('orders', ord.id)}
                                  aria-label={`Удалить заказ ${ord.id}`}
                                  className="min-h-[32px] min-w-[32px] rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleBuyouts.length > 0 && (
                      <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--svv-accent)]">
                          <Globe className="w-4 h-4" />
                          <span>Заявки на выкуп из Китая ({visibleBuyouts.length})</span>
                        </div>
                        <div className="divide-y divide-[var(--svv-border)]">
                          {visibleBuyouts.map((b) => (
                            <div key={b.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5 text-xs">
                              <div className="flex justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                  {b.imageUrl && (
                                    <img
                                      src={b.imageUrl}
                                      alt={b.sourceUrlOrName}
                                      referrerPolicy="no-referrer"
                                      className="w-12 h-14 rounded-xl object-cover bg-[var(--svv-well)] border border-[var(--svv-border)] shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-[var(--svv-text)] truncate">
                                      {b.id} · {b.brand} — {b.sourceUrlOrName}
                                    </p>
                                    <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                                      {formatRequestTimestamp(b.createdAt)} · {b.telegramHandle} ·
                                      Размер: {b.size} ·{' '}
                                      {b.shippingSpeed === 'air'
                                        ? 'Авиа ($45)'
                                        : `Карго (${b.weightKg ?? 1} кг)`}
                                    </p>
                                    {b.buyoutLink && isSafeExternalWebUrl(b.buyoutLink) && (
                                      <a
                                        href={b.buyoutLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--svv-accent)] hover:underline break-all"
                                      >
                                        <span>Ссылка на выкуп</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    )}
                                    {b.notes && (
                                      <p className="text-[11px] text-[var(--svv-text-soft)] mt-1">
                                        Комментарий: {b.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 tabular-nums">
                                  <p className="font-bold text-[var(--svv-accent)]">
                                    {formatRub(b.estimatedRub)}
                                    {b.shippingUsd ? ` + $${b.shippingUsd}` : ''}
                                  </p>
                                  <p className="text-[var(--svv-muted)]">{formatCny(b.priceCny)}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleCycleInboxStatus('buyouts', b.id, b.status)}
                                    className={`min-h-[32px] px-3 rounded-full border text-[11px] font-bold cursor-pointer press-spring ${statusBadgeClass(
                                      b.status
                                    )}`}
                                  >
                                    {getRequestStatusLabel(b.status)}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTrackingDraft({
                                        orderCode: b.id,
                                        telegramHandle: b.telegramHandle,
                                        itemTitle: `${b.brand} — ${b.sourceUrlOrName} (${b.size})`.slice(0, 160),
                                        imageUrl: b.imageUrl ?? '',
                                        stage: 'confirmed',
                                        carrierTrack: '',
                                        deliveryMethod:
                                          b.shippingSpeed === 'air'
                                            ? 'Авиа ($45)'
                                            : `Карго авто (${b.weightKg ?? 1} кг)`,
                                        etaLabel: b.shippingSpeed === 'air' ? '7–12 дней' : '16–24 дня',
                                        locationNote: 'Заявка на выкуп принята в обработку.',
                                      });
                                      setAdminTab('tracking');
                                    }}
                                    className="min-h-[32px] px-3 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Truck className="w-3 h-3" />
                                    <span>В трекинг</span>
                                  </button>
                                  {(() => {
                                    const tgUrl = buildTelegramConciergeUrl(
                                      b.telegramHandle,
                                      `Здравствуйте! По заявке на выкуп ${b.id} (${b.brand}):`
                                    );
                                    return (
                                      <a
                                        href={tgUrl}
                                        onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-h-[32px] px-3 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1"
                                      >
                                        <span>Написать в TG</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    );
                                  })()}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteInboxItem('buyouts', b.id)}
                                  aria-label={`Удалить заявку ${b.id}`}
                                  className="min-h-[32px] min-w-[32px] rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {visibleInquiries.length > 0 && (
                      <div className="p-5 rounded-2xl bg-[var(--svv-surface)] border border-[var(--svv-border)] space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--svv-accent)]">
                          <MessageSquare className="w-4 h-4" />
                          <span>Обращения к менеджеру ({visibleInquiries.length})</span>
                        </div>
                        <div className="divide-y divide-[var(--svv-border)]">
                          {visibleInquiries.map((inq) => (
                            <div key={inq.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5 text-xs">
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--svv-text)] truncate">
                                  {inq.id} · {inq.customerName} ({inq.telegramHandle})
                                </p>
                                <p className="text-[11px] text-[var(--svv-muted)] mt-0.5">
                                  {formatRequestTimestamp(inq.createdAt)} · {inq.topicLabel}
                                </p>
                                {inq.message && (
                                  <p className="text-[var(--svv-text-soft)] mt-1">{inq.message}</p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleCycleInboxStatus('inquiries', inq.id, inq.status)}
                                    className={`min-h-[32px] px-3 rounded-full border text-[11px] font-bold cursor-pointer press-spring ${statusBadgeClass(
                                      inq.status
                                    )}`}
                                  >
                                    {getRequestStatusLabel(inq.status)}
                                  </button>
                                  {(() => {
                                    const tgUrl = buildTelegramConciergeUrl(
                                      inq.telegramHandle,
                                      `Здравствуйте, ${inq.customerName}! Отвечаем на ваше обращение ${inq.id} в SVV SHOP:`
                                    );
                                    return (
                                      <a
                                        href={tgUrl}
                                        onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-h-[32px] px-3 rounded-full border border-[var(--svv-border-strong)] text-[11px] font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] inline-flex items-center gap-1"
                                      >
                                        <span>Написать в TG</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    );
                                  })()}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteInboxItem('inquiries', inq.id)}
                                  aria-label={`Удалить обращение ${inq.id}`}
                                  className="min-h-[32px] min-w-[32px] rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Product Inventory List */}
      {canEdit && adminTab === 'catalog' && (
        <div key="admin-catalog-list" className="tab-view-enter border border-[var(--svv-border)] rounded-2xl bg-[var(--svv-surface)] divide-y divide-[var(--svv-border)]">
          {products.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-[var(--svv-text)]">В каталоге пока нет позиций</p>
              <p className="text-xs text-[var(--svv-muted)]">
                Нажмите «Добавить вещь», чтобы загрузить первое реальное фото и выставить цену.
              </p>
            </div>
          ) : (
            products.map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-14 rounded-xl object-cover bg-[var(--svv-well)] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--svv-muted)]">
                      {item.brand} † {item.category}
                    </p>
                    <p className="text-sm font-medium text-[var(--svv-text)] truncate">{item.name}</p>
                    <p className="text-xs text-[var(--svv-muted)] tabular-nums mt-0.5">
                      {formatRub(item.price)} · {item.sizes.join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    aria-label={`Изменить ${item.name}`}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-[var(--svv-border)] text-[var(--svv-text)] hover:border-[var(--svv-border-strong)] press-spring cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteProduct(item.id)}
                    aria-label={`Удалить ${item.name}`}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-red-500 hover:border-red-500/40 press-spring cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
