export interface TelegramUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramWebAppInstance {
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  initData?: string;
  platform?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  openTelegramLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebAppInstance;
    };
  }
}

export function initTelegramMiniApp(): {
  isInsideTelegram: boolean;
  user: TelegramUser | null;
} {
  if (typeof window === 'undefined') {
    return { isInsideTelegram: false, user: null };
  }
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    return { isInsideTelegram: false, user: null };
  }
  try {
    tg.ready();
    tg.expand();
  } catch {
    // Ignore outside Telegram host
  }
  const user = tg.initDataUnsafe?.user ?? null;
  return {
    isInsideTelegram: Boolean(user || tg.initDataUnsafe),
    user,
  };
}

export function triggerHaptic(type: 'light' | 'success' = 'light'): void {
  try {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.isVersionAtLeast?.('6.1')) return;
    const haptic = tg.HapticFeedback;
    if (!haptic) return;
    if (type === 'success') {
      haptic.notificationOccurred('success');
    } else {
      haptic.impactOccurred('light');
    }
  } catch {
    // Ignore outside Telegram host
  }
}

export function buildTelegramConciergeUrl(handle: string, message: string): string {
  const cleanHandle = handle.replace(/^@/, '');
  return `https://t.me/${cleanHandle}?text=${encodeURIComponent(message)}`;
}

export function handleTelegramLinkClick(
  event: { preventDefault: () => void },
  url: string
): void {
  if (!url.startsWith('https://t.me/')) return;
  try {
    const tg = window.Telegram?.WebApp;
    const isRealTelegram = Boolean(
      tg && (tg.initData || tg.initDataUnsafe?.user || (tg.platform && tg.platform !== 'unknown'))
    );
    if (isRealTelegram && tg?.openTelegramLink) {
      event.preventDefault();
      tg.openTelegramLink(url);
    }
  } catch {
    // Fallback to normal anchor behavior outside Telegram WebView
  }
}
