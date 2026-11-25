import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { Check, Search, X } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  CATEGORIES,
  CREATOR_TELEGRAM_HANDLE,
  DEFAULT_HERO_BANNER,
  DEFAULT_PRIZE_WHEEL,
  DEFAULT_PROMO_CODES,
  LUXURY_PRODUCTS,
  MANAGER_TELEGRAM_HANDLE,
  THEME_OPTIONS,
  type AppTheme,
  type HeroBannerConfig,
  type LuxuryProduct,
  type PrizeWheelConfig,
  type ProductCategory,
  type PromoCodeItem,
} from './data/catalog';
import {
  addToCart,
  extractUniqueBrands,
  filterProducts,
  getCartCount,
  getNextTheme,
  getThemeLabel,
  updateCartQuantity,
  type CartItem,
  type InboxSummary,
  type ManagerInquiryReceipt,
  type OrderReceipt,
} from './utils/shopLogic';
import {
  checkIsAdminUser,
  deleteProductFromFirestore,
  saveProductToFirestore,
  subscribeCatalogProducts,
} from './services/catalogService';
import { initTelegramMiniApp, triggerHaptic } from './utils/telegram';
import { TopBar, type ActiveView } from './components/TopBar';
import { BottomTabBar, type MobileTab } from './components/BottomTabBar';
import { HomeFeedView } from './components/HomeFeedView';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ChinaBuyoutSection } from './components/ChinaBuyoutSection';
import { ManagerContactSection } from './components/ManagerContactSection';
import { CartDrawer } from './components/CartDrawer';
import { AdminCatalogPanel } from './components/AdminCatalogPanel';
import { AccountTrackingView } from './components/AccountTrackingView';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { LicenseAgreementModal } from './components/LicenseAgreementModal';

const STORAGE_CART_KEY = 'svv_shop_cart_v3';
const STORAGE_ORDERS_KEY = 'svv_shop_orders_v1';
const STORAGE_THEME_KEY = 'svv_shop_theme_v1';

const EMPTY_INBOX_SUMMARY: InboxSummary = {
  newOrdersCount: 0,
  newBuyoutsCount: 0,
  newInquiriesCount: 0,
  newTotalCount: 0,
};

function mergeCatalogWithServerOverrides(
  baseList: LuxuryProduct[],
  upserts: LuxuryProduct[],
  deletedIds: string[]
): LuxuryProduct[] {
  const deletedSet = new Set(deletedIds);
  const byId = new Map<string, LuxuryProduct>();
  for (const item of baseList) {
    if (!deletedSet.has(item.id)) byId.set(item.id, item);
  }
  for (const item of upserts) {
    if (!deletedSet.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export default function App() {
  const [baseProducts, setBaseProducts] = useState<LuxuryProduct[]>(LUXURY_PRODUCTS);
  const [serverUpserts, setServerUpserts] = useState<LuxuryProduct[]>([]);
  const [serverDeletedIds, setServerDeletedIds] = useState<string[]>([]);

  const products = useMemo(
    () => mergeCatalogWithServerOverrides(baseProducts, serverUpserts, serverDeletedIds),
    [baseProducts, serverUpserts, serverDeletedIds]
  );

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CART_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [savedOrderCodes, setSavedOrderCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [trackingLookupSeed, setTrackingLookupSeed] = useState('');

  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('Все');
  const [selectedBrand, setSelectedBrand] = useState<string>('Все бренды');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeProduct, setActiveProduct] = useState<LuxuryProduct | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLicenseOpen, setIsLicenseOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderReceipt | null>(null);
  const [, setLastInquiry] = useState<ManagerInquiryReceipt | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>(DEFAULT_PROMO_CODES);
  const [adminPromos, setAdminPromos] = useState<PromoCodeItem[]>(DEFAULT_PROMO_CODES);
  const [preselectedPromoCode, setPreselectedPromoCode] = useState('');
  const [prizeWheel, setPrizeWheel] = useState<PrizeWheelConfig>(DEFAULT_PRIZE_WHEEL);
  const [heroBanner, setHeroBanner] = useState<HeroBannerConfig>(DEFAULT_HERO_BANNER);

  const [tgDefaultName, setTgDefaultName] = useState('');
  const [tgDefaultHandle, setTgDefaultHandle] = useState('');

  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'obsidian' || saved === 'ivory' || saved === 'crimson') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'obsidian';
  });
  const [inboxSummary, setInboxSummary] = useState<InboxSummary>(EMPTY_INBOX_SUMMARY);

  // Firebase Auth (Google owner) + Server Bearer Auth (kept strictly in JS memory)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isCloudAdmin, setIsCloudAdmin] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [adminBearerToken, setAdminBearerToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'env' | 'claimed' | 'unclaimed'>('unclaimed');

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const { user } = initTelegramMiniApp();
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      if (fullName) setTgDefaultName(fullName);
      if (user.username) setTgDefaultHandle(`@${user.username}`);
    }
  }, []);

  const refreshInboxSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/summary');
      if (!res.ok) return;
      const data = (await res.json()) as Partial<InboxSummary>;
      setInboxSummary({
        newOrdersCount: Number(data.newOrdersCount) || 0,
        newBuyoutsCount: Number(data.newBuyoutsCount) || 0,
        newInquiriesCount: Number(data.newInquiriesCount) || 0,
        newTotalCount: Number(data.newTotalCount) || 0,
      });
    } catch {
      // Ignore if offline
    }
  }, []);

  useEffect(() => {
    void refreshInboxSummary();
    const timer = window.setInterval(() => {
      void refreshInboxSummary();
    }, 12000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshInboxSummary]);

  useEffect(() => {
    void refreshInboxSummary();
  }, [activeView, refreshInboxSummary]);

  useEffect(() => {
    fetch('/api/catalog/overrides')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { upserts?: LuxuryProduct[]; deletedIds?: string[] } | null) => {
        if (data?.upserts) setServerUpserts(data.upserts);
        if (data?.deletedIds) setServerDeletedIds(data.deletedIds);
      })
      .catch(() => {
        // Ignore if offline
      });

    fetch('/api/promos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { promos?: PromoCodeItem[] } | null) => {
        if (data?.promos) setPromoCodes(data.promos);
      })
      .catch(() => {
        // Ignore if offline
      });

    fetch('/api/wheel')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { wheel?: PrizeWheelConfig } | null) => {
        if (data?.wheel) setPrizeWheel(data.wheel);
      })
      .catch(() => {
        // Ignore if offline
      });

    fetch('/api/banner')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { banner?: HeroBannerConfig } | null) => {
        if (data?.banner) setHeroBanner(data.banner);
      })
      .catch(() => {
        // Ignore if offline
      });
  }, []);

  useEffect(() => {
    if (!adminBearerToken) return;
    let active = true;
    fetch('/api/admin/promos', {
      headers: { Authorization: `Bearer ${adminBearerToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { promos?: PromoCodeItem[] } | null) => {
        if (active && data?.promos) setAdminPromos(data.promos);
      })
      .catch(() => {
        // Ignore if offline
      });
    return () => {
      active = false;
    };
  }, [adminBearerToken]);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mode?: 'env' | 'claimed' | 'unclaimed' } | null) => {
        if (active && data?.mode) setAuthMode(data.mode);
      })
      .catch(() => {
        // Ignore if offline
      });
    return () => {
      active = false;
    };
  }, [activeView]);

  useEffect(() => {
    const unsubscribe = subscribeCatalogProducts(
      (remoteList, remoteExists) => {
        if (remoteExists) {
          setBaseProducts(remoteList);
        }
      },
      () => {
        // Fallback to local state if Firestore rules/network unavailable
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (!user) {
        setIsCloudAdmin(false);
        return;
      }
      const adminOk = await checkIsAdminUser(user.uid, user.email, user.emailVerified);
      setIsCloudAdmin(adminOk);
    });
    return unsub;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(savedOrderCodes));
    } catch {
      // Ignore quota errors
    }
  }, [savedOrderCodes]);

  const showFeedback = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === message ? null : curr));
    }, 2200);
  };

  const handleSelectTheme = (nextTheme: AppTheme) => {
    triggerHaptic('light');
    setTheme(nextTheme);
    showFeedback(`Тема: ${getThemeLabel(nextTheme)}`);
  };

  const handleCycleTheme = () => {
    handleSelectTheme(getNextTheme(theme));
  };

  const brandOptions = useMemo(() => extractUniqueBrands(products), [products]);

  const filteredProducts = useMemo(
    () =>
      filterProducts(products, {
        category: selectedCategory,
        brand: selectedBrand,
        search: searchQuery,
      }),
    [products, selectedCategory, selectedBrand, searchQuery]
  );

  const cartCount = useMemo(() => getCartCount(cart), [cart]);

  const rememberOrderCode = (code: string) => {
    const clean = code.trim();
    if (!clean) return;
    setSavedOrderCodes((prev) => [clean, ...prev.filter((c) => c !== clean)].slice(0, 12));
  };

  const handleAddToCart = (productId: string, size: string) => {
    triggerHaptic('success');
    setLastOrder(null);
    setCart((prev) => addToCart(prev, productId, size, 1));
    const product = products.find((p) => p.id === productId);
    showFeedback(product ? `${product.brand} (${size}) в корзине` : 'Добавлено в корзину');
  };

  const handleQuickAdd = (product: LuxuryProduct) => {
    const defaultSize = product.sizes[0] || 'One Size';
    handleAddToCart(product.id, defaultSize);
  };

  const handleAddFitToCart = (items: LuxuryProduct[]) => {
    triggerHaptic('success');
    setLastOrder(null);
    setCart((prev) => {
      let next = prev;
      for (const p of items) {
        next = addToCart(next, p.id, p.sizes[0] || 'One Size', 1);
      }
      return next;
    });
    showFeedback('Случайный фит добавлен в корзину');
  };

  const handleUpdateQty = (productId: string, size: string, delta: number) => {
    triggerHaptic('light');
    setCart((prev) => updateCartQuantity(prev, productId, size, delta));
  };

  const handleSelectView = (view: ActiveView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMobileTabSelect = (tab: MobileTab) => {
    triggerHaptic('light');
    if (tab === 'cart') {
      setIsCartOpen(true);
      return;
    }
    handleSelectView(tab);
  };

  const handleOpenSearch = () => {
    setActiveView('catalog');
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 120);
  };

  const refreshAdminStatus = async () => {
    try {
      const res = await fetch('/api/admin/status');
      if (!res.ok) return null;
      const data = (await res.json()) as { mode?: 'env' | 'claimed' | 'unclaimed' };
      if (data.mode) setAuthMode(data.mode);
      return data.mode ?? null;
    } catch {
      return null;
    }
  };

  const handlePasswordClaimOrLogin = async (password: string, isClaim: boolean) => {
    const endpoint = isClaim ? '/api/admin/claim' : '/api/admin/login';
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    let data = (await res.json()) as {
      token?: string;
      mode?: 'env' | 'claimed';
      error?: string;
    };

    if (res.status === 409) {
      const latestMode = await refreshAdminStatus();
      if (isClaim && (latestMode === 'claimed' || latestMode === 'env')) {
        res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        data = (await res.json()) as {
          token?: string;
          mode?: 'env' | 'claimed';
          error?: string;
        };
      }
    }

    if (!res.ok || !data.token) {
      throw new Error(data.error || 'Неверный пароль администратора.');
    }
    setAdminBearerToken(data.token);
    if (data.mode) setAuthMode(data.mode);
    showFeedback('Вход в админку выполнен');
  };

  const handleLockPasswordSession = () => {
    if (adminBearerToken) {
      void fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminBearerToken}` },
      }).catch(() => {
        // Ignore network errors on logout
      });
    }
    setAdminBearerToken(null);
    showFeedback('Админ-сессия заблокирована');
  };

  const handleChangeAdminPassword = async (currentPassword: string, newPassword: string) => {
    if (!adminBearerToken) {
      throw new Error('Сессия администратора истекла. Войдите снова.');
    }
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await res.json()) as {
      token?: string;
      mode?: 'env' | 'claimed';
      envConfigured?: boolean;
      error?: string;
    };
    if (!res.ok || !data.token) {
      if (res.status === 401 && data.error?.includes('Сессия')) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      throw new Error(data.error || 'Не удалось изменить пароль администратора.');
    }
    setAdminBearerToken(data.token);
    if (data.mode) setAuthMode(data.mode);
    showFeedback('Пароль администратора обновлён');
    return { envConfigured: Boolean(data.envConfigured) };
  };

  const handleSignInGoogle = async () => {
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      showFeedback('Вход отменён');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOutGoogle = async () => {
    await signOut(auth);
    setIsCloudAdmin(false);
  };

  const handleSaveProduct = async (product: LuxuryProduct, isNew: boolean) => {
    if (isCloudAdmin && authUser) {
      await saveProductToFirestore(product, authUser.uid, isNew);
      showFeedback(isNew ? 'Вещь сохранена в облаке' : 'Изменения сохранены');
      return;
    }
    if (!adminBearerToken) {
      throw new Error('Сессия администратора истекла. Войдите снова.');
    }
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify(product),
    });
    const data = (await res.json()) as { product?: LuxuryProduct; error?: string };
    if (!res.ok || !data.product) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      throw new Error(data.error || 'Ошибка сохранения позиции.');
    }
    setServerDeletedIds((prev) => prev.filter((id) => id !== product.id));
    setServerUpserts((prev) => [product, ...prev.filter((p) => p.id !== product.id)]);
    showFeedback(isNew ? 'Вещь добавлена в каталог' : 'Позиция обновлена');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isCloudAdmin && authUser) {
      await deleteProductFromFirestore(productId);
      showFeedback('Вещь удалена');
      return;
    }
    if (!adminBearerToken) {
      showFeedback('Требуется вход администратора');
      return;
    }
    const res = await fetch(`/api/catalog/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminBearerToken}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      showFeedback('Ошибка удаления');
      return;
    }
    setServerUpserts((prev) => prev.filter((p) => p.id !== productId));
    setServerDeletedIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    showFeedback('Вещь удалена');
  };

  const syncPublicPromos = (nextAll: PromoCodeItem[]) => {
    setAdminPromos(nextAll);
    setPromoCodes(nextAll.filter((p) => p.active));
  };

  const handleCreatePromo = async (promo: PromoCodeItem) => {
    if (!adminBearerToken) {
      throw new Error('Сессия администратора истекла. Войдите снова.');
    }
    const res = await fetch('/api/promos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify(promo),
    });
    const data = (await res.json()) as { promo?: PromoCodeItem; error?: string };
    if (!res.ok || !data.promo) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      throw new Error(data.error || 'Ошибка создания промокода.');
    }
    syncPublicPromos([data.promo, ...adminPromos.filter((p) => p.code !== data.promo!.code)]);
    showFeedback(`Промокод ${data.promo.code} создан`);
  };

  const handleTogglePromo = async (code: string, nextActive: boolean) => {
    if (!adminBearerToken) {
      showFeedback('Требуется вход администратора');
      return;
    }
    const res = await fetch(`/api/promos/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify({ active: nextActive }),
    });
    const data = (await res.json()) as { promo?: PromoCodeItem };
    if (!res.ok || !data.promo) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      showFeedback('Не удалось обновить статус');
      return;
    }
    syncPublicPromos(adminPromos.map((p) => (p.code === code ? data.promo! : p)));
    showFeedback(nextActive ? `Промокод ${code} включён` : `Промокод ${code} отключён`);
  };

  const handleDeletePromo = async (code: string) => {
    if (!adminBearerToken) {
      showFeedback('Требуется вход администратора');
      return;
    }
    const res = await fetch(`/api/promos/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminBearerToken}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      showFeedback('Ошибка удаления промокода');
      return;
    }
    syncPublicPromos(adminPromos.filter((p) => p.code !== code));
    showFeedback(`Промокод ${code} удалён`);
  };

  const handleSaveWheel = async (nextWheel: PrizeWheelConfig) => {
    if (!adminBearerToken) {
      throw new Error('Сессия администратора истекла. Войдите снова.');
    }
    const res = await fetch('/api/wheel', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify(nextWheel),
    });
    const data = (await res.json()) as { wheel?: PrizeWheelConfig; error?: string };
    if (!res.ok || !data.wheel) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      throw new Error(data.error || 'Не удалось сохранить колесо призов.');
    }
    setPrizeWheel(data.wheel);
    showFeedback('Колесо призов обновлено');
  };

  const handleSaveBanner = async (nextBanner: HeroBannerConfig) => {
    if (!adminBearerToken) {
      throw new Error('Сессия администратора истекла. Войдите снова.');
    }
    const res = await fetch('/api/banner', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBearerToken}`,
      },
      body: JSON.stringify(nextBanner),
    });
    const data = (await res.json()) as { banner?: HeroBannerConfig; error?: string };
    if (!res.ok || !data.banner) {
      if (res.status === 401) {
        setAdminBearerToken(null);
        void refreshAdminStatus();
      }
      throw new Error(data.error || 'Не удалось сохранить баннер.');
    }
    setHeroBanner(data.banner);
    showFeedback('Главный баннер обновлён');
  };

  const handleApplyWonPromo = (code: string) => {
    triggerHaptic('success');
    setPreselectedPromoCode(code);
    showFeedback(`Промокод ${code} применён`);
    setIsCartOpen(true);
  };

  const resetFilters = () => {
    setSelectedCategory('Все');
    setSelectedBrand('Все бренды');
    setSearchQuery('');
  };

  const catalogBrandsLine = useMemo(() => {
    const added = brandOptions.slice(1);
    return added.length > 0
      ? `Добавленные бренды: ${added.join(', ')}.`
      : 'Актуальные позиции каталога SVV SHOP.';
  }, [brandOptions]);

  return (
    <div className="relative min-h-screen bg-[var(--svv-bg)] text-[var(--svv-text)] pb-20 md:pb-8 overflow-x-hidden flex flex-col transition-colors">
      <AmbientBackdrop />

      <div className="relative z-10 flex-1 flex flex-col">
        <TopBar
          activeView={activeView}
          cartCount={cartCount}
          savedOrdersCount={savedOrderCodes.length}
          newOrdersCount={inboxSummary.newOrdersCount}
          newRequestsCount={inboxSummary.newTotalCount}
          theme={theme}
          onCycleTheme={handleCycleTheme}
          onSelectView={handleSelectView}
          onOpenSearch={handleOpenSearch}
          onOpenCart={() => setIsCartOpen(true)}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto sm:px-6">
          <div key={activeView} className="tab-view-enter">
              {activeView === 'home' && (
                <HomeFeedView
                  products={products}
                  prizeWheel={prizeWheel}
                  heroBanner={heroBanner}
                  onOpenDetail={(p) => setActiveProduct(p)}
                  onQuickAdd={handleQuickAdd}
                  onSelectCategory={(cat) => {
                    setSelectedCategory(cat);
                    setSelectedBrand('Все бренды');
                    handleSelectView('catalog');
                  }}
                  onGoToCatalog={() => handleSelectView('catalog')}
                  onGoToChinaBuyout={() => handleSelectView('china')}
                  onGoToManager={() => handleSelectView('manager')}
                  onGoToAdmin={() => handleSelectView('admin')}
                  onAddFitToCart={handleAddFitToCart}
                  onApplyWonPromo={handleApplyWonPromo}
                />
              )}

              {activeView === 'catalog' && (
                <section className="py-5 sm:py-8 px-4 sm:px-0">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
                    <div>
                      <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-[var(--svv-text)] tracking-tight">
                        Каталог SVV † SHOP
                      </h1>
                      <p className="mt-1 text-xs sm:text-sm text-[var(--svv-muted)]">
                        {catalogBrandsLine}
                      </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                      <Search className="w-4 h-4 text-[var(--svv-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Поиск по брендам и вещам"
                        placeholder="Поиск..."
                        className="w-full min-h-[42px] pl-10 pr-9 py-1.5 rounded-full bg-[var(--svv-surface)] border border-[var(--svv-border)] text-sm text-[var(--svv-text)] placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-border-strong)]"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Очистить поиск"
                          className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] flex items-center justify-center text-[var(--svv-muted)] hover:text-[var(--svv-text)] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5 mb-6 min-w-0">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full max-w-full">
                      {CATEGORIES.map((category) => {
                        const active = selectedCategory === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            className={`min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              active
                                ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)]'
                                : 'bg-[var(--svv-surface)] border border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
                            }`}
                          >
                            {category}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full max-w-full min-w-0">
                        {brandOptions.map((brand) => {
                          const active = selectedBrand === brand;
                          return (
                            <button
                              key={brand}
                              type="button"
                              onClick={() => setSelectedBrand(brand)}
                              className={`min-h-[34px] px-3 py-1 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                active
                                  ? 'border-[var(--svv-border-strong)] text-[var(--svv-text)] font-bold bg-[var(--svv-surface-2)]'
                                  : 'border-[var(--svv-border)] text-[var(--svv-muted)] bg-transparent hover:border-[var(--svv-border-strong)]'
                              }`}
                            >
                              {brand}
                            </button>
                          );
                        })}
                      </div>

                      {(selectedCategory !== 'Все' ||
                        selectedBrand !== 'Все бренды' ||
                        searchQuery) && (
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="text-xs font-semibold text-[var(--svv-accent)] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="py-16 px-4 text-center space-y-3 bg-[var(--svv-surface)] border border-[var(--svv-border)] rounded-2xl">
                      <p className="text-base font-semibold text-[var(--svv-text)]">
                        {products.length === 0 ? 'Витрина пока пуста' : 'Ничего не найдено'}
                      </p>
                      <p className="text-xs text-[var(--svv-muted)] max-w-md mx-auto">
                        {products.length === 0
                          ? 'Добавьте реальные вещи через Админ-панель или закажите нужную позицию напрямую через «Выкуп из Китая».'
                          : 'Попробуйте сбросить фильтры или закажите нужную вещь через «Выкуп из Китая».'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {products.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleSelectView('admin')}
                            className="min-h-[40px] px-4 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold cursor-pointer"
                          >
                            Открыть Админ-панель
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={resetFilters}
                            className="min-h-[40px] px-4 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold cursor-pointer"
                          >
                            Показать все
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSelectView('china')}
                          className="min-h-[40px] px-4 py-2 rounded-full border border-[var(--svv-border-strong)] text-[var(--svv-text)] text-xs font-semibold cursor-pointer"
                        >
                          Выкуп из Китая
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-3.5 gap-y-6 sm:gap-5">
                      {filteredProducts.map((product, idx) => (
                        <div
                          key={product.id}
                          style={{ '--stagger': idx % 8 } as React.CSSProperties}
                          className="stagger-item"
                        >
                          <ProductCard
                            product={product}
                            onOpenDetail={(p) => setActiveProduct(p)}
                            onQuickAdd={handleQuickAdd}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {activeView === 'china' && (
                <ChinaBuyoutSection
                  defaultHandle={tgDefaultHandle}
                  onSubmitted={(ticket) => {
                    triggerHaptic('success');
                    rememberOrderCode(ticket.id);
                    showFeedback(`Заявка ${ticket.id} принята`);
                    void refreshInboxSummary();
                  }}
                  onGoToTracking={(orderCode) => {
                    setTrackingLookupSeed(orderCode);
                    handleSelectView('account');
                  }}
                />
              )}

              {activeView === 'manager' && (
                <ManagerContactSection
                  defaultName={tgDefaultName}
                  defaultHandle={tgDefaultHandle}
                  onInquiryCreated={(receipt) => {
                    triggerHaptic('success');
                    setLastInquiry(receipt);
                    showFeedback(`Обращение ${receipt.id} отправлено`);
                    void refreshInboxSummary();
                  }}
                />
              )}

              {activeView === 'account' && (
                <AccountTrackingView
                  defaultName={tgDefaultName}
                  defaultHandle={tgDefaultHandle}
                  initialLookupQuery={trackingLookupSeed}
                  savedOrderCodes={savedOrderCodes}
                  onGoToCatalog={() => handleSelectView('catalog')}
                  onGoToChinaBuyout={() => handleSelectView('china')}
                />
              )}

              {activeView === 'admin' && (
                <AdminCatalogPanel
                  products={products}
                  heroBanner={heroBanner}
                  adminPromos={adminPromos}
                  prizeWheel={prizeWheel}
                  inboxSummary={inboxSummary}
                  userEmail={authUser?.email ?? null}
                  isCloudAdmin={isCloudAdmin}
                  adminBearerToken={adminBearerToken}
                  authMode={authMode}
                  authBusy={authBusy}
                  onInboxChanged={() => void refreshInboxSummary()}
                  onPasswordClaimOrLogin={handlePasswordClaimOrLogin}
                  onChangeAdminPassword={handleChangeAdminPassword}
                  onLockPasswordSession={handleLockPasswordSession}
                  onSignInGoogle={() => void handleSignInGoogle()}
                  onSignOutGoogle={() => void handleSignOutGoogle()}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onSaveBanner={handleSaveBanner}
                  onCreatePromo={handleCreatePromo}
                  onTogglePromo={handleTogglePromo}
                  onDeletePromo={handleDeletePromo}
                  onSaveWheel={handleSaveWheel}
                />
              )}
        </div>
      </main>

      <footer className="relative z-10 border-t border-[var(--svv-border)] py-6 mt-auto px-4 sm:px-6 bg-[var(--svv-footer)] backdrop-blur-sm transition-colors">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--svv-muted)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>SVV † SHOP · {MANAGER_TELEGRAM_HANDLE}</span>
            <span aria-hidden="true" className="opacity-40">
              |
            </span>
            <span>Создатель: {CREATOR_TELEGRAM_HANDLE}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5" role="group" aria-label="Выбор темы оформления">
              <span className="text-[11px]">Тема:</span>
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectTheme(opt.id)}
                    className={`min-h-[30px] px-2.5 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                        : 'border-[var(--svv-border)] text-[var(--svv-muted)] hover:text-[var(--svv-text)]'
                    }`}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsLicenseOpen(true)}
              className="hover:text-[var(--svv-text)] transition-colors cursor-pointer"
            >
              Лицензионное соглашение
            </button>
            <button
              type="button"
              onClick={() => handleSelectView('manager')}
              className="hover:text-[var(--svv-text)] transition-colors cursor-pointer"
            >
              Связь с менеджером
            </button>
            <button
              type="button"
              onClick={() => handleSelectView(activeView === 'admin' ? 'home' : 'admin')}
              className="hover:text-[var(--svv-text)] transition-colors cursor-pointer"
            >
              {activeView === 'admin' ? 'Вернуться в магазин' : 'Админ-панель'}
            </button>
          </div>
        </div>
      </footer>
      </div>

      <BottomTabBar
        activeView={activeView}
        cartCount={cartCount}
        savedOrdersCount={savedOrderCodes.length}
        onSelectTab={handleMobileTabSelect}
      />

      <ProductDetailModal
        product={activeProduct}
        onClose={() => setActiveProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        isOpen={isCartOpen}
        products={products}
        promoCodes={promoCodes}
        preselectedPromoCode={preselectedPromoCode}
        cart={cart}
        defaultName={tgDefaultName}
        defaultHandle={tgDefaultHandle}
        lastOrder={lastOrder}
        onClose={() => setIsCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onOrderConfirmed={(receipt) => {
          triggerHaptic('success');
          rememberOrderCode(receipt.id);
          setLastOrder(receipt);
          setCart([]);
          void refreshInboxSummary();
        }}
        onClearReceipt={() => setLastOrder(null)}
        onGoToTracking={(orderCode) => {
          setTrackingLookupSeed(orderCode);
          handleSelectView('account');
        }}
      />

      <LicenseAgreementModal
        isOpen={isLicenseOpen}
        onClose={() => setIsLicenseOpen(false)}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 z-40 px-4 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold shadow-lg flex items-center gap-2 whitespace-nowrap toast-pop-in"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
