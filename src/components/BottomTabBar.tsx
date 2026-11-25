import { Globe, Home, LayoutGrid, ShoppingCart, User } from 'lucide-react';
import type { ActiveView } from './TopBar';

export type MobileTab = 'home' | 'catalog' | 'china' | 'cart' | 'account';

interface BottomTabBarProps {
  activeView: ActiveView;
  cartCount: number;
  savedOrdersCount: number;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomTabBar({
  activeView,
  cartCount,
  savedOrdersCount,
  onSelectTab,
}: BottomTabBarProps) {
  const tabs: Array<{
    id: MobileTab;
    label: string;
    icon: typeof Home;
    badge?: number;
  }> = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'catalog', label: 'Каталог', icon: LayoutGrid },
    { id: 'china', label: 'Выкуп', icon: Globe },
    { id: 'cart', label: 'Корзина', icon: ShoppingCart, badge: cartCount },
    { id: 'account', label: 'Кабинет', icon: User, badge: savedOrdersCount },
  ];

  return (
    <nav
      aria-label="Мобильная навигация"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--svv-nav-bg)] border-t border-[var(--svv-nav-border)] pb-safe text-[var(--svv-nav-fg)] transition-colors"
    >
      <div className="grid grid-cols-5 h-16 items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`relative h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer press-spring ${
                isActive
                  ? 'text-[var(--svv-nav-fg)]'
                  : 'text-[var(--svv-nav-muted)] hover:text-[var(--svv-nav-fg)]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0 left-4 right-4 h-[2.5px] bg-[var(--svv-nav-fg)] rounded-b-full transition-all duration-300 ${
                  isActive ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'
                }`}
              />
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? '-translate-y-0.5 scale-105' : ''
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.75}
                />
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--svv-nav-fg)] text-[var(--svv-nav-bg)] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight whitespace-nowrap ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
