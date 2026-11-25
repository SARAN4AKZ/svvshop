import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  CREATOR_TELEGRAM_HANDLE,
  DEFAULT_HERO_BANNER,
  DEFAULT_PRIZE_WHEEL,
  MANAGER_TELEGRAM_HANDLE,
  type LuxuryProduct,
  type PromoCodeItem,
} from '../data/catalog';
import {
  addToCart,
  applyPromoCode,
  calculateCartSubtotal,
  calculateChinaBuyoutQuote,
  calculateOrderTotal,
  calculateWheelTargetAngle,
  CHINA_AIR_SHIPPING_USD,
  CHINA_BUYOUT_COMMISSION_RATE,
  CHINA_CARGO_RUB_PER_KG,
  CHINA_CNY_RATE,
  countNewAdminRequests,
  createSafeProductId,
  extractUniqueBrands,
  filterProducts,
  formatRequestTimestamp,
  formatRub,
  generateRandomFit,
  getCartCount,
  getDeliveryOption,
  getManagerTopicLabel,
  getNextRequestStatus,
  getNextTheme,
  getRequestStatusLabel,
  getThemeLabel,
  getTrackingStageIndex,
  getTrackingStageLabel,
  isSafeMediaUrl,
  normalizePromoCode,
  normalizeTelegramHandle,
  parseSizesRaw,
  pickWeightedSegmentIndex,
  updateCartQuantity,
  validateAdminProductInput,
  validateCheckoutInput,
  validateChinaBuyoutInput,
  validateHeroBannerInput,
  validateManagerInquiryInput,
  validatePasswordChangeInput,
  validatePromoCodeInput,
  validateTrackingInput,
  validateWheelSegments,
} from './shopLogic';

const SAMPLE_PRODUCTS: LuxuryProduct[] = [
  {
    id: 'item-hoodie-1',
    brand: 'Archive Line',
    category: 'Худи и свитшоты',
    name: 'Худи Heavyweight',
    price: 118000,
    availability: 'В наличии',
    imageUrl: '/uploads/sample-hoodie.jpg',
    sizes: ['S', 'M', 'L'],
    composition: '100% хлопок',
    origin: 'Португалия',
    stylistNote: 'Плотный трикотаж.',
    pairingTip: 'С широкими джинсами.',
  },
  {
    id: 'item-pants-2',
    brand: 'Studio Cut',
    category: 'Штаны',
    name: 'Широкие карго',
    price: 145000,
    availability: 'В наличии',
    imageUrl: '/uploads/sample-pants.jpg',
    sizes: ['M', 'L'],
    composition: '100% деним',
    origin: 'Италия',
    stylistNote: 'Свободная посадка.',
    pairingTip: 'С массивными кроссовками.',
  },
  {
    id: 'item-beanie-3',
    brand: 'Noir Craft',
    category: 'Аксессуары',
    name: 'Шапка Cross Patch',
    price: 49900,
    availability: 'В наличии',
    imageUrl: '/uploads/sample-beanie.jpg',
    sizes: ['One Size'],
    composition: '100% шерсть',
    origin: 'США',
    stylistNote: 'Фирменный патч.',
    pairingTip: 'К пуховику.',
  },
  {
    id: 'item-bag-4',
    brand: 'Atelier Noir',
    category: 'Сумки',
    name: 'Кожаная сумка',
    price: 274000,
    availability: 'В наличии',
    imageUrl: '/uploads/sample-bag.jpg',
    sizes: ['One Size'],
    composition: '100% кожа телёнка',
    origin: 'Италия',
    stylistNote: 'Матовая кожа.',
    pairingTip: 'К тёмному луку.',
  },
];

test('filterProducts filters by category and dynamically extracted brands', () => {
  const byBrand = filterProducts(SAMPLE_PRODUCTS, {
    category: 'Все',
    brand: 'Noir Craft',
    search: '',
  });
  assert.equal(byBrand.length, 1);
  assert.equal(byBrand[0].brand, 'Noir Craft');

  const brands = extractUniqueBrands(SAMPLE_PRODUCTS);
  assert.ok(brands.includes('Archive Line'));
  assert.ok(brands.includes('Studio Cut'));
  assert.ok(brands.includes('Atelier Noir'));
});

test('cart operations, promo codes, and delivery selection calculate accurate order total', () => {
  let cart = addToCart([], 'item-hoodie-1', 'M', 1);
  cart = addToCart(cart, 'item-bag-4', 'One Size', 1);

  const subtotal = calculateCartSubtotal(cart, SAMPLE_PRODUCTS);
  assert.equal(subtotal, 118000 + 274000);
  assert.equal(getCartCount(cart), 2);

  const promo = applyPromoCode(subtotal, 'svv10');
  assert.equal(promo.valid, true);
  assert.equal(promo.discountRub, Math.round(subtotal * 0.1));

  assert.equal(getDeliveryOption('courier_msk').price, 0);
  assert.equal(
    calculateOrderTotal(subtotal, 'cdek_rf', promo.discountRub),
    subtotal - promo.discountRub + 1500
  );
  assert.equal(calculateOrderTotal(subtotal, 'intl_dhl'), subtotal + 6500);

  cart = updateCartQuantity(cart, 'item-hoodie-1', 'M', -1);
  assert.equal(getCartCount(cart), 1);
});

test('dynamic admin promo codes respect minSubtotal, active status, and validation', () => {
  const customPromos: PromoCodeItem[] = [
    {
      code: 'DARK25',
      discountType: 'percent',
      discountValue: 25,
      minSubtotal: 50000,
      label: 'Архивный −25%',
      active: true,
    },
    {
      code: 'OFFLINE',
      discountType: 'fixed',
      discountValue: 5000,
      minSubtotal: 0,
      label: 'Отключённый код',
      active: false,
    },
  ];

  assert.equal(normalizePromoCode(' dark 25! '), 'DARK25');
  assert.equal(applyPromoCode(30000, 'dark25', customPromos).valid, false);
  const validHit = applyPromoCode(100000, 'dark25', customPromos);
  assert.equal(validHit.valid, true);
  assert.equal(validHit.discountRub, 25000);
  assert.equal(applyPromoCode(100000, 'offline', customPromos).valid, false);

  assert.equal(
    validatePromoCodeInput({
      code: 'ab',
      discountType: 'percent',
      discountValue: 95,
      minSubtotal: -10,
    }).length,
    3
  );
});

test('prize wheel selection, target angle alignment, and handle @SVV_manager checks', () => {
  assert.equal(MANAGER_TELEGRAM_HANDLE, '@SVV_manager');
  const segments = DEFAULT_PRIZE_WHEEL.segments;
  assert.deepEqual(validateWheelSegments(segments), []);

  const firstIdx = pickWeightedSegmentIndex(segments, 0.01);
  const lastIdx = pickWeightedSegmentIndex(segments, 0.99);
  assert.equal(firstIdx, 0);
  assert.equal(lastIdx, segments.length - 1);

  const sliceAngle = 360 / segments.length;
  for (let i = 0; i < segments.length; i++) {
    const target = calculateWheelTargetAngle(45, i, segments.length, 5);
    assert.ok(target > 45 + 5 * 360 - 1);
    const centerAfterRotation = (((i + 0.5) * sliceAngle + target) % 360 + 360) % 360;
    assert.ok(Math.abs(centerAfterRotation) < 0.001 || Math.abs(centerAfterRotation - 360) < 0.001);
  }
});

test('calculateChinaBuyoutQuote and validateChinaBuyoutInput use 13.8 rate, 9% fee, free report, $45 air and 750/kg cargo', () => {
  assert.equal(CHINA_CNY_RATE, 13.8);
  assert.equal(CHINA_BUYOUT_COMMISSION_RATE, 0.09);
  assert.equal(CHINA_AIR_SHIPPING_USD, 45);
  assert.equal(CHINA_CARGO_RUB_PER_KG, 750);

  const zeroQuote = calculateChinaBuyoutQuote({ priceCny: 0, shippingSpeed: 'air' });
  assert.equal(zeroQuote.totalRub, 0);
  assert.equal(zeroQuote.shippingUsd, 0);
  assert.equal(zeroQuote.inspectionRub, 0);

  const airQuote = calculateChinaBuyoutQuote({
    priceCny: 1000,
    shippingSpeed: 'air',
  });
  assert.equal(airQuote.cnyRate, 13.8);
  assert.equal(airQuote.goodsRub, 13800);
  assert.equal(airQuote.serviceFeeRub, Math.round(13800 * 0.09));
  assert.equal(airQuote.inspectionRub, 0);
  assert.equal(airQuote.shippingUsd, 45);
  assert.equal(airQuote.shippingRub, 0);
  assert.equal(airQuote.totalRub, 13800 + Math.round(13800 * 0.09));

  const cargoQuote = calculateChinaBuyoutQuote({
    priceCny: 1000,
    shippingSpeed: 'cargo',
    weightKg: 2,
  });
  assert.equal(cargoQuote.shippingUsd, 0);
  assert.equal(cargoQuote.shippingRub, 1500);
  assert.equal(cargoQuote.totalRub, 13800 + Math.round(13800 * 0.09) + 1500);

  const badBuyout = validateChinaBuyoutInput({
    buyoutLink: 'not-a-url',
    sourceUrlOrName: 'x',
    brand: '',
    size: '42',
    priceCny: 0,
    telegramHandle: 'a',
  });
  assert.equal(badBuyout.length, 3);

  const okBuyout = validateChinaBuyoutInput({
    buyoutLink: 'https://www.poizon.com/product/12345',
    sourceUrlOrName: 'Кроссовки',
    brand: 'Archive Line',
    size: 'EU 42',
    priceCny: 6200,
    telegramHandle: '@svv_client',
    imageUrl: '/uploads/test.jpg',
  });
  assert.deepEqual(okBuyout, []);
});

test('expanded clothing categories include Носки and tracking validation helpers work', () => {
  assert.ok(CATEGORIES.includes('Носки'));
  assert.ok(CATEGORIES.includes('Нижнее бельё'));
  assert.ok(CATEGORIES.includes('Головные уборы'));

  assert.equal(getTrackingStageIndex('confirmed'), 0);
  assert.equal(getTrackingStageIndex('ready_delivered'), 4);
  assert.equal(getTrackingStageLabel('in_transit'), 'В пути (Авиа / Карго)');

  assert.equal(
    validateTrackingInput({
      orderCode: '',
      telegramHandle: 'x',
      itemTitle: '',
      imageUrl: 'javascript:alert(1)',
    }).length,
    4
  );
  assert.deepEqual(
    validateTrackingInput({
      orderCode: 'SVV-1042',
      telegramHandle: '@svv_client',
      itemTitle: 'Носки Heavy',
      imageUrl: '/uploads/socks.jpg',
    }),
    []
  );
});

test('generateRandomFit creates a balanced multi-item outfit from available products', () => {
  assert.deepEqual(generateRandomFit([], 0), []);
  const fit = generateRandomFit(SAMPLE_PRODUCTS, 2);
  assert.equal(fit.length, 3);
  const uniqueIds = new Set(fit.map((p) => p.id));
  assert.equal(uniqueIds.size, 3);
});

test('validateCheckoutInput allows pickup without street address and rejects missing address for courier', () => {
  const pickupErrors = validateCheckoutInput(
    {
      customerName: 'Алина',
      telegramHandle: 'alina_svv',
      deliveryOptionId: 'pickup',
      deliveryAddress: '',
      paymentMethod: 'concierge',
    },
    1
  );
  assert.deepEqual(pickupErrors, []);

  const courierErrors = validateCheckoutInput(
    {
      customerName: 'Алина',
      telegramHandle: '@alina_svv',
      deliveryOptionId: 'cdek_rf',
      deliveryAddress: '',
      paymentMethod: 'concierge',
    },
    1
  );
  assert.equal(courierErrors.length, 1);
  assert.equal(normalizeTelegramHandle('alina_svv'), '@alina_svv');
});

test('admin product validation and helpers enforce strict constraints', () => {
  const bad = validateAdminProductInput({
    brand: '',
    category: 'Кроссовки',
    name: 'А',
    price: 0,
    availability: 'В наличии',
    imageUrl: '',
    sizesRaw: '38, 39',
    composition: 'Кожа',
    origin: 'Италия',
    stylistNote: '',
    pairingTip: '',
  });
  assert.equal(bad.length, 4);

  const ok = validateAdminProductInput({
    brand: 'Studio Cut',
    category: 'Куртки',
    name: 'Бомбер Flight Dark',
    price: 165000,
    availability: 'В наличии',
    imageUrl: '/uploads/svv-test.jpg',
    sizesRaw: 'S, M, L',
    composition: '100% технический нейлон',
    origin: 'Италия',
    stylistNote: 'Удлинённые рукава и плотная молния.',
    pairingTip: 'С широкими карго.',
  });
  assert.deepEqual(ok, []);
  assert.deepEqual(parseSizesRaw('S, M, L'), ['S', 'M', 'L']);
  assert.match(createSafeProductId('Studio Cut', 42), /^studio-cut-42$/);
  assert.ok(formatRub(165000).endsWith('₽'));
});

test('validateManagerInquiryInput and getManagerTopicLabel validate contact form', () => {
  const errs = validateManagerInquiryInput({
    customerName: '',
    telegramHandle: 'x',
    topic: 'photos',
    message: '',
  });
  assert.equal(errs.length, 2);

  const validErrs = validateManagerInquiryInput({
    customerName: 'Макс',
    telegramHandle: '@max_archive',
    topic: 'china',
    message: 'Нужны замеры стельки',
  });
  assert.deepEqual(validErrs, []);
  assert.equal(getManagerTopicLabel('photos'), 'Живые фото и видео вещи');
});

test('creator handle is @demnagvasali, admin request status helpers, and theme cycling work cleanly', () => {
  assert.equal(CREATOR_TELEGRAM_HANDLE, '@demnagvasali');
  assert.equal(
    countNewAdminRequests([{ status: 'new' }, { status: 'in_progress' }, { status: 'done' }, {}]),
    2
  );
  assert.equal(getNextRequestStatus('new'), 'in_progress');
  assert.equal(getNextRequestStatus('in_progress'), 'done');
  assert.equal(getNextRequestStatus('done'), 'new');
  assert.equal(getRequestStatusLabel('in_progress'), 'В работе');
  assert.ok(formatRequestTimestamp('2026-11-21T08:30:00.000Z').length >= 5);

  assert.equal(getNextTheme('obsidian'), 'ivory');
  assert.equal(getNextTheme('ivory'), 'crimson');
  assert.equal(getNextTheme('crimson'), 'obsidian');
  assert.equal(getThemeLabel('ivory'), 'Светлая');
  assert.equal(getThemeLabel('crimson'), 'Бордо');
});

test('validateHeroBannerInput and isSafeMediaUrl enforce safe banner inputs', () => {
  assert.deepEqual(validateHeroBannerInput(DEFAULT_HERO_BANNER), []);
  assert.equal(isSafeMediaUrl('https://cdn.example.com/banner.jpg'), true);
  assert.equal(isSafeMediaUrl('/uploads/banner.jpg'), true);
  assert.equal(isSafeMediaUrl('javascript:alert(1)'), false);
  assert.equal(isSafeMediaUrl('//evil.example.com/a.jpg'), false);

  const badBanner = validateHeroBannerInput({
    ...DEFAULT_HERO_BANNER,
    title: 'A',
    subtitle: '',
    primaryCtaLabel: '',
    secondaryCtaLabel: '',
    imageUrl: 'javascript:alert(1)',
  });
  assert.equal(badBanner.length, 5);
});

test('validatePasswordChangeInput checks length, distinctness, and confirmation', () => {
  assert.equal(
    validatePasswordChangeInput({
      currentPassword: '',
      newPassword: '123',
      confirmPassword: '456',
    }).length,
    3
  );
  assert.equal(
    validatePasswordChangeInput({
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmPassword: 'same-password',
    }).length,
    1
  );
  assert.deepEqual(
    validatePasswordChangeInput({
      currentPassword: 'old-password',
      newPassword: 'new-strong-password',
      confirmPassword: 'new-strong-password',
    }),
    []
  );
});
