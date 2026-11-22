export type ProductCategory =
  | 'Все'
  | 'Куртки'
  | 'Худи и свитшоты'
  | 'Штаны'
  | 'Кроссовки'
  | 'Сумки'
  | 'Аксессуары'
  | 'Костюмы и платья';

export type LuxuryBrand = string;

export interface LuxuryProduct {
  id: string;
  brand: string;
  category: Exclude<ProductCategory, 'Все'>;
  name: string;
  price: number;
  availability: string;
  imageUrl: string;
  sizes: string[];
  composition: string;
  origin: string;
  stylistNote: string;
  pairingTip: string;
  order?: number;
}

export interface DeliveryOption {
  id: 'courier_msk' | 'cdek_rf' | 'intl_dhl' | 'pickup';
  title: string;
  eta: string;
  price: number;
  description: string;
}

export interface CategoryTile {
  category: Exclude<ProductCategory, 'Все'>;
  label: string;
  tag: string;
}

export interface ChinaBuyoutPreset {
  id: string;
  label: string;
  priceCny: number;
  category: 'sneakers' | 'hoodie' | 'jacket' | 'bag';
  sizeHint: string;
}

export type AppTheme = 'obsidian' | 'ivory' | 'crimson';

export const THEME_OPTIONS: Array<{ id: AppTheme; label: string; shortLabel: string }> = [
  { id: 'obsidian', label: 'Тёмная (Архив)', shortLabel: 'Тёмная' },
  { id: 'ivory', label: 'Светлая (Минимал)', shortLabel: 'Светлая' },
  { id: 'crimson', label: 'Бордо (Нефор)', shortLabel: 'Бордо' },
];

export const CATEGORIES: ProductCategory[] = [
  'Все',
  'Куртки',
  'Худи и свитшоты',
  'Штаны',
  'Кроссовки',
  'Сумки',
  'Аксессуары',
  'Костюмы и платья',
];

export const CATEGORY_TILES: CategoryTile[] = [
  {
    category: 'Куртки',
    label: 'Куртки',
    tag: 'OUTER',
  },
  {
    category: 'Худи и свитшоты',
    label: 'Свитшоты',
    tag: 'KNIT',
  },
  {
    category: 'Штаны',
    label: 'Штаны',
    tag: 'CARGO',
  },
  {
    category: 'Кроссовки',
    label: 'Кроссовки',
    tag: 'SHOES',
  },
];

export const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'courier_msk',
    title: 'Курьер по Москве',
    eta: 'Сегодня · 2–4 часа',
    price: 0,
    description: 'Бесплатная доставка и примерка до 30 минут.',
  },
  {
    id: 'cdek_rf',
    title: 'СДЭК по России',
    eta: '2–4 рабочих дня',
    price: 1500,
    description: 'Экспресс-доставка до двери или пункта выдачи.',
  },
  {
    id: 'intl_dhl',
    title: 'Международная (DHL)',
    eta: '5–9 дней',
    price: 6500,
    description: 'Застрахованная отправка по всему миру.',
  },
  {
    id: 'pickup',
    title: 'Шоурум SVV',
    eta: 'Готово сегодня',
    price: 0,
    description: 'Примерка и выдача в закрытом шоуруме.',
  },
];

export const CHINA_BUYOUT_PRESETS: ChinaBuyoutPreset[] = [
  {
    id: 'china-sneakers',
    label: 'Кроссовки · Авиа',
    priceCny: 2450,
    category: 'sneakers',
    sizeHint: 'EU 42',
  },
  {
    id: 'china-hoodie',
    label: 'Худи / Зип-худи',
    priceCny: 1650,
    category: 'hoodie',
    sizeHint: 'M',
  },
  {
    id: 'china-jacket',
    label: 'Куртка / Пуховик',
    priceCny: 3200,
    category: 'jacket',
    sizeHint: 'L',
  },
  {
    id: 'china-bag',
    label: 'Сумка / Аксессуар',
    priceCny: 1200,
    category: 'bag',
    sizeHint: 'One Size',
  },
];

export type WheelAccent = 'obsidian' | 'bone' | 'smoke' | 'crimson';

export interface PromoCodeItem {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSubtotal: number;
  label: string;
  active: boolean;
}

export interface PrizeWheelSegment {
  id: string;
  label: string;
  shortLabel: string;
  promoCode: string;
  description: string;
  weight: number;
  accent: WheelAccent;
}

export interface PrizeWheelConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  segments: PrizeWheelSegment[];
}

export interface HeroBannerConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  promoMetricLabel: string;
  promoMetricValue: string;
  sealTop: string;
  sealBottom: string;
  tickerOverride: string;
  imageUrl: string;
}

export const LUXURY_PRODUCTS: LuxuryProduct[] = [];

export const MANAGER_TELEGRAM_HANDLE = '@SVV_manager';
export const CREATOR_TELEGRAM_HANDLE = '@demnagvasali';

export const DEFAULT_HERO_BANNER: HeroBannerConfig = {
  eyebrow: `SVV † STORE · ${MANAGER_TELEGRAM_HANDLE}`,
  title: 'SVV † SHOP',
  subtitle: 'Витрина одежды и прямой выкуп из Китая',
  description: '',
  primaryCtaLabel: 'Открыть каталог',
  secondaryCtaLabel: 'Выкуп из Китая',
  promoMetricLabel: 'Срок выкупа',
  promoMetricValue: 'Авиа 7–12 дней',
  sealTop: 'SVV †',
  sealBottom: 'SHOP',
  tickerOverride: '',
  imageUrl: '',
};

export const DEFAULT_PROMO_CODES: PromoCodeItem[] = [
  {
    code: 'SVV10',
    discountType: 'percent',
    discountValue: 10,
    minSubtotal: 0,
    label: 'Скидка 10% по коду SVV10',
    active: true,
  },
  {
    code: 'SVV1500',
    discountType: 'fixed',
    discountValue: 1500,
    minSubtotal: 0,
    label: 'Бонус 1 500 ₽ по коду SVV1500',
    active: true,
  },
  {
    code: 'WHEEL5',
    discountType: 'percent',
    discountValue: 5,
    minSubtotal: 0,
    label: 'Приз колеса: −5% по коду WHEEL5',
    active: true,
  },
  {
    code: 'WHEEL2K',
    discountType: 'fixed',
    discountValue: 2000,
    minSubtotal: 15000,
    label: 'Приз колеса: −2 000 ₽ от 15 000 ₽',
    active: true,
  },
];

export const DEFAULT_PRIZE_WHEEL: PrizeWheelConfig = {
  enabled: true,
  title: 'Колесо призов SVV',
  subtitle: 'Крутите колесо удачи и заберите скидку в корзину или бонус от @SVV_manager',
  segments: [
    {
      id: 'seg-wheel-5',
      label: 'Скидка 5% на заказ',
      shortLabel: '−5%',
      promoCode: 'WHEEL5',
      description: 'Моментальная скидка 5% на любую вещь из каталога.',
      weight: 30,
      accent: 'obsidian',
    },
    {
      id: 'seg-wheel-2k',
      label: 'Бонус 2 000 ₽',
      shortLabel: '−2 000 ₽',
      promoCode: 'WHEEL2K',
      description: 'Скидка 2 000 ₽ на заказ от 15 000 ₽.',
      weight: 20,
      accent: 'bone',
    },
    {
      id: 'seg-svv-1500',
      label: 'Бонус 1 500 ₽',
      shortLabel: '−1 500 ₽',
      promoCode: 'SVV1500',
      description: 'Скидка 1 500 ₽ на любой заказ из витрины.',
      weight: 20,
      accent: 'smoke',
    },
    {
      id: 'seg-svv10',
      label: 'Скидка клуба −10%',
      shortLabel: '−10%',
      promoCode: 'SVV10',
      description: 'Максимальная скидка 10% по секретному коду клуба.',
      weight: 15,
      accent: 'crimson',
    },
    {
      id: 'seg-stickers',
      label: 'Стикерпак SVV †',
      shortLabel: 'МЕРЧ SVV',
      promoCode: '',
      description: 'Лимитированный набор стикеров к заказу — напишите @SVV_manager.',
      weight: 10,
      accent: 'obsidian',
    },
    {
      id: 'seg-vip',
      label: 'Приоритет выкупа',
      shortLabel: 'VIP ДРОП',
      promoCode: '',
      description: 'Персональный поиск редкого размера из Китая через @SVV_manager.',
      weight: 5,
      accent: 'bone',
    },
  ],
};
