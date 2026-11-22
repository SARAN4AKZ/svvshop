import {
  DEFAULT_PROMO_CODES,
  DELIVERY_OPTIONS,
  LUXURY_PRODUCTS,
  THEME_OPTIONS,
  type AppTheme,
  type DeliveryOption,
  type HeroBannerConfig,
  type LuxuryBrand,
  type LuxuryProduct,
  type PrizeWheelConfig,
  type PrizeWheelSegment,
  type ProductCategory,
  type PromoCodeItem,
} from '../data/catalog';

export interface CartItem {
  productId: string;
  size: string;
  quantity: number;
}

export interface CheckoutInput {
  customerName: string;
  telegramHandle: string;
  deliveryOptionId: DeliveryOption['id'];
  deliveryAddress: string;
  paymentMethod: 'concierge' | 'invoice';
  promoCode?: string;
}

export type ManagerTopic = 'sizing' | 'photos' | 'china' | 'order';

export interface ManagerInquiryInput {
  customerName: string;
  telegramHandle: string;
  topic: ManagerTopic;
  message: string;
}

export interface AdminProductInput {
  id?: string;
  brand: string;
  category: LuxuryProduct['category'];
  name: string;
  price: number;
  availability: string;
  imageUrl: string;
  sizesRaw: string;
  composition: string;
  origin: string;
  stylistNote: string;
  pairingTip: string;
}

export interface ChinaBuyoutQuoteInput {
  priceCny: number;
  category: 'sneakers' | 'hoodie' | 'jacket' | 'bag';
  shippingSpeed: 'air' | 'cargo';
}

export interface ChinaBuyoutQuote {
  cnyRate: number;
  goodsRub: number;
  inspectionRub: number;
  shippingRub: number;
  serviceFeeRub: number;
  totalRub: number;
  etaLabel: string;
}

export interface ChinaBuyoutFormInput {
  sourceUrlOrName: string;
  brand: string;
  size: string;
  priceCny: number;
  telegramHandle: string;
}

export interface PromoEvaluation {
  valid: boolean;
  code: string;
  discountRub: number;
  label: string;
}

export interface OrderReceipt {
  id: string;
  createdAtLabel: string;
  customerName: string;
  telegramHandle: string;
  deliveryTitle: string;
  deliveryPrice: number;
  deliveryAddress: string;
  paymentMethod: 'concierge' | 'invoice';
  promoCode?: string;
  discountAmount: number;
  items: Array<{
    product: LuxuryProduct;
    size: string;
    quantity: number;
  }>;
  subtotalAmount: number;
  totalAmount: number;
}

export interface ManagerInquiryReceipt {
  id: string;
  createdAtLabel: string;
  customerName: string;
  telegramHandle: string;
  topicLabel: string;
  message: string;
}

export type RequestStatus = 'new' | 'in_progress' | 'done';

export interface InboxSummary {
  newOrdersCount: number;
  newBuyoutsCount: number;
  newInquiriesCount: number;
  newTotalCount: number;
}

export function getNextTheme(current: AppTheme): AppTheme {
  const idx = THEME_OPTIONS.findIndex((t) => t.id === current);
  if (idx < 0) return THEME_OPTIONS[0].id;
  return THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length].id;
}

export function getThemeLabel(theme: AppTheme): string {
  return THEME_OPTIONS.find((t) => t.id === theme)?.shortLabel ?? 'Тёмная';
}

export function countNewAdminRequests(
  statuses: Array<{ status?: RequestStatus }>
): number {
  return statuses.filter((item) => !item.status || item.status === 'new').length;
}

export function getNextRequestStatus(current?: RequestStatus): RequestStatus {
  if (!current || current === 'new') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'new';
}

export function getRequestStatusLabel(status?: RequestStatus): string {
  if (status === 'in_progress') return 'В работе';
  if (status === 'done') return 'Закрыта';
  return 'Новая';
}

export function formatRequestTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Недавно';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function formatRub(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amount))} ₽`;
}

export function formatCny(amount: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(amount))} ¥`;
}

export function getDeliveryOption(id: DeliveryOption['id']): DeliveryOption {
  return DELIVERY_OPTIONS.find((opt) => opt.id === id) ?? DELIVERY_OPTIONS[0];
}

export function filterProducts(
  products: LuxuryProduct[],
  options: {
    category: ProductCategory;
    brand: LuxuryBrand;
    search: string;
    favoritesOnly?: boolean;
    favoriteIds?: string[];
  }
): LuxuryProduct[] {
  const query = options.search.trim().toLowerCase();
  const favSet = new Set(options.favoriteIds ?? []);

  return products.filter((item) => {
    if (options.category !== 'Все' && item.category !== options.category) {
      return false;
    }
    if (options.brand !== 'Все бренды' && item.brand !== options.brand) {
      return false;
    }
    if (options.favoritesOnly && !favSet.has(item.id)) {
      return false;
    }
    if (query) {
      const haystack = `${item.brand} ${item.name} ${item.category} ${item.composition}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function extractUniqueBrands(products: LuxuryProduct[]): string[] {
  const seen = new Set<string>();
  const list: string[] = ['Все бренды'];
  for (const p of products) {
    const clean = p.brand.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      list.push(clean);
    }
  }
  return list;
}

export function addToCart(cart: CartItem[], productId: string, size: string, qty = 1): CartItem[] {
  const safeQty = Math.max(1, Math.floor(qty));
  const idx = cart.findIndex((c) => c.productId === productId && c.size === size);
  if (idx >= 0) {
    return cart.map((item, i) =>
      i === idx ? { ...item, quantity: item.quantity + safeQty } : item
    );
  }
  return [...cart, { productId, size, quantity: safeQty }];
}

export function updateCartQuantity(
  cart: CartItem[],
  productId: string,
  size: string,
  delta: number
): CartItem[] {
  return cart
    .map((item) => {
      if (item.productId === productId && item.size === size) {
        return { ...item, quantity: item.quantity + delta };
      }
      return item;
    })
    .filter((item) => item.quantity > 0);
}

export function getCartCount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateCartSubtotal(
  cart: CartItem[],
  products: LuxuryProduct[] = LUXURY_PRODUCTS
): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.reduce((sum, item) => {
    const product = byId.get(item.productId);
    if (!product) return sum;
    return sum + product.price * item.quantity;
  }, 0);
}

export function applyPromoCode(
  subtotal: number,
  rawCode?: string,
  promoList: PromoCodeItem[] = DEFAULT_PROMO_CODES
): PromoEvaluation {
  const code = normalizePromoCode(rawCode ?? '');
  if (!code || subtotal <= 0) {
    return { valid: false, code: '', discountRub: 0, label: '' };
  }
  const matched = promoList.find((p) => p.active && p.code.toUpperCase() === code);
  if (!matched) {
    return { valid: false, code, discountRub: 0, label: 'Промокод не найден' };
  }
  if (matched.minSubtotal > 0 && subtotal < matched.minSubtotal) {
    return {
      valid: false,
      code,
      discountRub: 0,
      label: `Промокод ${matched.code} действует от ${formatRub(matched.minSubtotal)}`,
    };
  }
  const discountRub =
    matched.discountType === 'percent'
      ? Math.round(subtotal * (Math.min(90, Math.max(1, matched.discountValue)) / 100))
      : Math.min(subtotal, Math.max(0, Math.round(matched.discountValue)));

  const defaultLabel =
    matched.discountType === 'percent'
      ? `Скидка ${matched.discountValue}% по коду ${matched.code}`
      : `Бонус ${formatRub(matched.discountValue)} по коду ${matched.code}`;

  return {
    valid: true,
    code: matched.code,
    discountRub,
    label: matched.label.trim() || defaultLabel,
  };
}

export function normalizePromoCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
}

export function validatePromoCodeInput(input: {
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minSubtotal: number;
}): string[] {
  const errors: string[] = [];
  const code = normalizePromoCode(input.code);
  if (code.length < 3 || code.length > 24) {
    errors.push('Код промокода должен содержать 3–24 латинских символа или цифры.');
  }
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) {
    errors.push('Укажите корректный размер скидки.');
  } else if (input.discountType === 'percent' && input.discountValue > 90) {
    errors.push('Процентная скидка не может превышать 90%.');
  } else if (input.discountType === 'fixed' && input.discountValue > 500000) {
    errors.push('Фиксированная скидка слишком велика.');
  }
  if (!Number.isFinite(input.minSubtotal) || input.minSubtotal < 0) {
    errors.push('Минимальная сумма заказа не может быть отрицательной.');
  }
  return errors;
}

export function pickWeightedSegmentIndex(
  segments: PrizeWheelSegment[],
  randomFloat: number
): number {
  if (segments.length === 0) return 0;
  const totalWeight = segments.reduce((sum, seg) => sum + Math.max(1, seg.weight), 0);
  const clamped = Math.min(0.999999, Math.max(0, randomFloat));
  let cursor = clamped * totalWeight;
  for (let i = 0; i < segments.length; i++) {
    cursor -= Math.max(1, segments[i].weight);
    if (cursor < 0) return i;
  }
  return segments.length - 1;
}

export function calculateWheelTargetAngle(
  currentAngle: number,
  segmentIndex: number,
  totalSegments: number,
  extraTurns = 5
): number {
  const safeTotal = Math.max(1, totalSegments);
  const sliceAngle = 360 / safeTotal;
  const centerAngle = (segmentIndex + 0.5) * sliceAngle;
  const targetMod = (360 - (centerAngle % 360) + 360) % 360;
  const currentMod = ((currentAngle % 360) + 360) % 360;
  const deltaMod = (targetMod - currentMod + 360) % 360;
  return currentAngle + Math.max(1, extraTurns) * 360 + deltaMod;
}

export function validateWheelSegments(segments: PrizeWheelSegment[]): string[] {
  const errors: string[] = [];
  if (segments.length < 2 || segments.length > 10) {
    errors.push('В колесе должно быть от 2 до 10 секторов.');
  }
  for (const seg of segments) {
    if (seg.label.trim().length < 2 || seg.shortLabel.trim().length < 1) {
      errors.push('У каждого сектора должны быть название и короткая подпись.');
      break;
    }
    if (!Number.isFinite(seg.weight) || seg.weight < 1 || seg.weight > 100) {
      errors.push('Шанс (вес) каждого сектора должен быть от 1 до 100.');
      break;
    }
  }
  return errors;
}

export function getWheelSignature(config: PrizeWheelConfig): string {
  return config.segments.map((s) => `${s.id}:${s.shortLabel}:${s.promoCode}`).join('|');
}

export function calculateOrderTotal(
  subtotal: number,
  deliveryOptionId: DeliveryOption['id'],
  discountRub = 0
): number {
  const delivery = getDeliveryOption(deliveryOptionId);
  return Math.max(0, subtotal - Math.max(0, discountRub) + delivery.price);
}

export function calculateChinaBuyoutQuote(input: ChinaBuyoutQuoteInput): ChinaBuyoutQuote {
  const cnyRate = 13.8;
  const safeCny = Number.isFinite(input.priceCny) ? Math.max(0, input.priceCny) : 0;
  const goodsRub = Math.round(safeCny * cnyRate);

  const baseWeightShipping =
    input.category === 'jacket'
      ? 3600
      : input.category === 'sneakers'
      ? 3100
      : input.category === 'hoodie'
      ? 2400
      : 1900;

  const shippingRub =
    safeCny <= 0
      ? 0
      : input.shippingSpeed === 'air'
      ? baseWeightShipping
      : Math.max(1200, baseWeightShipping - 1100);

  const inspectionRub = safeCny > 0 ? 900 : 0;
  const serviceFeeRub = safeCny > 0 ? Math.max(1500, Math.round(goodsRub * 0.08)) : 0;
  const totalRub = goodsRub + inspectionRub + shippingRub + serviceFeeRub;

  return {
    cnyRate,
    goodsRub,
    inspectionRub,
    shippingRub,
    serviceFeeRub,
    totalRub,
    etaLabel: input.shippingSpeed === 'air' ? '7–12 дней (Авиа)' : '16–24 дня (Карго)',
  };
}

export function validateChinaBuyoutInput(input: ChinaBuyoutFormInput): string[] {
  const errors: string[] = [];
  if (input.sourceUrlOrName.trim().length < 3) {
    errors.push('Вставьте ссылку или укажите название вещи.');
  }
  if (!Number.isFinite(input.priceCny) || input.priceCny <= 0 || input.priceCny > 500000) {
    errors.push('Укажите корректную цену товара в юанях (¥).');
  }
  if (!validateTelegramHandle(input.telegramHandle)) {
    errors.push('Укажите корректный Telegram @username для фотоотчёта.');
  }
  return errors;
}

export function generateRandomFit(
  products: LuxuryProduct[],
  seed = 0
): LuxuryProduct[] {
  if (products.length === 0) return [];
  const tops = products.filter((p) =>
    p.category === 'Худи и свитшоты' || p.category === 'Куртки' || p.category === 'Костюмы и платья'
  );
  const bottoms = products.filter((p) => p.category === 'Штаны');
  const footwearAndBags = products.filter(
    (p) => p.category === 'Кроссовки' || p.category === 'Сумки' || p.category === 'Аксессуары'
  );

  const picked: LuxuryProduct[] = [];
  const seen = new Set<string>();
  const addPick = (pool: LuxuryProduct[], offset: number) => {
    if (pool.length === 0) return;
    const item = pool[(Math.abs(seed) + offset) % pool.length];
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      picked.push(item);
    }
  };

  addPick(tops, 0);
  addPick(bottoms, 1);
  addPick(footwearAndBags, 2);

  for (let i = 0; i < products.length && picked.length < Math.min(3, products.length); i++) {
    const fallback = products[(Math.abs(seed) + i) % products.length];
    if (fallback && !seen.has(fallback.id)) {
      seen.add(fallback.id);
      picked.push(fallback);
    }
  }
  return picked;
}

export function validateTelegramHandle(raw: string): boolean {
  const trimmed = raw.trim();
  return /^@?[a-zA-Z0-9_]{3,32}$/.test(trimmed);
}

export function normalizeTelegramHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

export function validateCheckoutInput(input: CheckoutInput, cartCount: number): string[] {
  const errors: string[] = [];
  if (cartCount <= 0) {
    errors.push('Добавьте хотя бы одно изделие в корзину.');
  }
  if (input.customerName.trim().length < 2) {
    errors.push('Укажите имя получателя (минимум 2 символа).');
  }
  if (!validateTelegramHandle(input.telegramHandle)) {
    errors.push('Укажите корректный Telegram @username (от 3 символов).');
  }
  if (input.deliveryOptionId !== 'pickup' && input.deliveryAddress.trim().length < 5) {
    errors.push('Укажите город и адрес доставки.');
  }
  return errors;
}

export function validateManagerInquiryInput(input: ManagerInquiryInput): string[] {
  const errors: string[] = [];
  if (input.customerName.trim().length < 2) {
    errors.push('Укажите ваше имя.');
  }
  if (!validateTelegramHandle(input.telegramHandle)) {
    errors.push('Укажите корректный Telegram @username для ответа менеджера.');
  }
  return errors;
}

export function parseSizesRaw(raw: string): string[] {
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  return list.length > 0 ? list : ['One Size'];
}

export function validateAdminProductInput(input: AdminProductInput): string[] {
  const errors: string[] = [];
  if (input.brand.trim().length < 1 || input.brand.trim().length > 80) {
    errors.push('Укажите бренд (от 1 до 80 символов).');
  }
  if (input.name.trim().length < 2 || input.name.trim().length > 140) {
    errors.push('Укажите название вещи (от 2 до 140 символов).');
  }
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 100000000) {
    errors.push('Укажите корректную цену в рублях.');
  }
  if (input.imageUrl.trim().length < 1) {
    errors.push('Выберите, загрузите или укажите ссылку на фото вещи.');
  }
  return errors;
}

export function createSafeProductId(brand: string, suffixSeed?: number): string {
  const slug =
    brand
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 16) || 'item';
  const rand =
    typeof suffixSeed === 'number' ? suffixSeed : Math.floor(1000 + Math.random() * 9000);
  return `${slug}-${rand}`;
}

export function getManagerTopicLabel(topic: ManagerTopic): string {
  switch (topic) {
    case 'sizing':
      return 'Уточнить замеры и посадку';
    case 'photos':
      return 'Живые фото и видео вещи';
    case 'china':
      return 'Индивидуальный выкуп из Китая';
    case 'order':
      return 'Статус заказа и доставка';
  }
}

export function isSafeMediaUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('//')) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('https://');
}

export function validateHeroBannerInput(banner: HeroBannerConfig): string[] {
  const errors: string[] = [];
  if (banner.title.trim().length < 2 || banner.title.trim().length > 60) {
    errors.push('Заголовок баннера должен содержать от 2 до 60 символов.');
  }
  if (banner.subtitle.trim().length < 2 || banner.subtitle.trim().length > 140) {
    errors.push('Подзаголовок баннера должен содержать от 2 до 140 символов.');
  }
  if (banner.primaryCtaLabel.trim().length < 2 || banner.primaryCtaLabel.trim().length > 40) {
    errors.push('Текст первой кнопки должен содержать от 2 до 40 символов.');
  }
  if (banner.secondaryCtaLabel.trim().length < 2 || banner.secondaryCtaLabel.trim().length > 40) {
    errors.push('Текст второй кнопки должен содержать от 2 до 40 символов.');
  }
  if (!isSafeMediaUrl(banner.imageUrl)) {
    errors.push('Фоновое изображение должно начинаться с https:// или /uploads/.');
  }
  return errors;
}

export function validatePasswordChangeInput(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): string[] {
  const errors: string[] = [];
  const current = input.currentPassword.trim();
  const next = input.newPassword.trim();
  const confirm = input.confirmPassword.trim();
  if (!current) {
    errors.push('Введите текущий пароль администратора.');
  }
  if (next.length < 4 || next.length > 128) {
    errors.push('Новый пароль должен содержать от 4 до 128 символов.');
  }
  if (current && next && current === next) {
    errors.push('Новый пароль должен отличаться от текущего.');
  }
  if (next !== confirm) {
    errors.push('Подтверждение не совпадает с новым паролем.');
  }
  return errors;
}
