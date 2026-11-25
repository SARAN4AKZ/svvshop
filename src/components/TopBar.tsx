import { Bell, Flame, MessageSquare, Moon, Search, Shield, ShoppingBag, Sun, User } from 'lucide-react';
import type { AppTheme } from '../data/catalog';
import { getThemeLabel } from '../utils/shopLogic';

export type ActiveView = 'home' | 'catalog' | 'china' | 'manager' | 'account' | 'admin';

interface TopBarProps {
  activeView: ActiveView;
  cartCount: number;
  savedOrdersCount: number;
  newOrdersCount: number;
  newRequestsCount: number;
  theme: AppTheme;
  onCycleTheme: () => void;
  onSelectView: (view: ActiveView) => void;
  onOpenSearch: () => void;
  onOpenCart: () => void;
}

export function TopBar({
  activeView,
  cartCount,
  savedOrdersCount,
  newOrdersCount,
  newRequestsCount,
  theme,
  onCycleTheme,
  onSelectView,
  onOpenSearch,
  onOpenCart,
}: TopBarProps) {
  const navItems: Array<{ id: ActiveView; label: string }> = [
    { id: 'home', label: 'Главная' },
    { id: 'catalog', label: 'Каталог' },
    { id: 'china', label: 'Выкуп' },
    { id: 'manager', label: 'Менеджер' },
    { id: 'admin', label: 'Админ' },
  ];

  const badgeCount = newOrdersCount > 0 ? newOrdersCount : newRequestsCount;
  const hasOrderNotification = newOrdersCount > 0;
  const ThemeIcon = theme === 'ivory' ? Sun : theme === 'crimson' ? Flame : Moon;
  const themeLabel = getThemeLabel(theme);

  const adminAriaLabel =
    badgeCount > 0
      ? `Панель администратора — новых заказов: ${newOrdersCount}, всего заявок: ${newRequestsCount}`
      : 'Панель администратора';

  return (
    <header className="sticky top-0 z-30 bg-[var(--svv-header)] backdrop-blur-md border-b border-[var(--svv-border)] transition-colors">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('home')}
          className="font-display italic text-xl sm:text-2xl font-black tracking-tighter whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
        >
          <span className="chrome-wordmark">SVV</span>
          <span className="text-[var(--svv-accent)] text-base sm:text-lg not-italic font-normal">
            †
          </span>
          <span className="chrome-wordmark">SHOP</span>
        </button>

        {/* Zone 2: Desktop Navigation Links */}
        <nav
          aria-label="Основная навигация"
          className="hidden md:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const active = activeView === item.id;
            const showAdminBadge = item.id === 'admin' && badgeCount > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                aria-label={item.id === 'admin' ? adminAriaLabel : item.label}
                className={`relative text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1.5 inline-flex items-center gap-1.5 ${
                  active
                    ? 'text-[var(--svv-text)]'
                    : 'text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
                }`}
              >
                <span>{item.label}</span>
                {showAdminBadge && (
                  <span
                    title={
                      hasOrderNotification
                        ? `Новых заказов: ${newOrdersCount}`
                        : `Новых заявок: ${newRequestsCount}`
                    }
                    className="relative inline-flex items-center gap-1 px-1.5 h-5 rounded-full bg-[var(--svv-notify)] text-[var(--svv-notify-fg)] text-[10px] font-bold tabular-nums shadow-sm"
                  >
                    {hasOrderNotification && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full bg-[var(--svv-notify)] animate-ping opacity-45"
                      />
                    )}
                    <Bell className="relative w-3 h-3" />
                    <span className="relative">{badgeCount}</span>
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[var(--svv-accent)] rounded-full transition-all duration-200 origin-center ${
                    active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Actions (Theme, Search, Account/Tracking, Cart, Mobile Admin) */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCycleTheme}
            aria-label={`Сменить тему (сейчас: ${themeLabel})`}
            title={`Тема: ${themeLabel}`}
            className="min-h-[44px] min-w-[36px] sm:min-w-[42px] sm:px-2.5 flex items-center justify-center gap-1.5 rounded-full text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors cursor-pointer"
          >
            <ThemeIcon className="w-[17px] h-[17px]" />
            <span className="hidden lg:inline text-[11px] font-semibold whitespace-nowrap">
              {themeLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Поиск по каталогу"
            className="min-h-[44px] min-w-[36px] sm:min-w-[42px] flex items-center justify-center rounded-full text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors cursor-pointer"
          >
            <Search className="w-[18px] h-[18px] sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={() => onSelectView('account')}
            aria-label="Личный кабинет и трекинг заказа"
            title="Личный кабинет и трекинг"
            className={`relative min-h-[44px] min-w-[36px] sm:min-w-[42px] lg:w-auto lg:px-3 flex items-center justify-center gap-1.5 rounded-full transition-colors cursor-pointer ${
              activeView === 'account'
                ? 'bg-[var(--svv-surface-2)] text-[var(--svv-text)]'
                : 'text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)]'
            }`}
          >
            <User className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
            <span className="hidden lg:inline text-xs font-semibold whitespace-nowrap">
              Личный кабинет
            </span>
            {savedOrdersCount > 0 && (
              <span className="lg:static absolute top-1.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-[10px] font-bold flex items-center justify-center tabular-nums">
                {savedOrdersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Открыть корзину, товаров: ${cartCount}`}
            className="relative min-h-[44px] min-w-[36px] sm:w-auto sm:px-3.5 flex items-center justify-center gap-2 rounded-full text-[var(--svv-text)] sm:bg-[var(--svv-accent)] sm:text-[var(--svv-accent-fg)] hover:opacity-90 transition-opacity cursor-pointer"
          >
            <ShoppingBag className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
              Корзина
            </span>
            {cartCount > 0 && (
              <span className="sm:hidden absolute top-1.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-[10px] font-bold flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
            <span className="hidden sm:inline text-xs font-mono font-bold tabular-nums">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('manager')}
            aria-label="Связь с менеджером"
            className={`md:hidden min-h-[44px] min-w-[36px] flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeView === 'manager'
                ? 'text-[var(--svv-text)] bg-[var(--svv-surface-2)]'
                : 'text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
            }`}
          >
            <MessageSquare className="w-[17px] h-[17px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectView('admin')}
            aria-label={adminAriaLabel}
            className={`md:hidden relative min-h-[44px] min-w-[36px] flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeView === 'admin'
                ? 'text-[var(--svv-text)] bg-[var(--svv-surface-2)]'
                : badgeCount > 0
                ? 'text-[var(--svv-text)]'
                : 'text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
            }`}
          >
            <Shield className="w-[17px] h-[17px]" />
            {badgeCount > 0 && (
              <span className="absolute top-1.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--svv-notify)] text-[var(--svv-notify-fg)] text-[10px] font-bold flex items-center justify-center tabular-nums shadow-sm">
                {hasOrderNotification && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[var(--svv-notify)] animate-ping opacity-55"
                  />
                )}
                <span className="relative">{badgeCount}</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
