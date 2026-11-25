import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  DEFAULT_HERO_BANNER,
  DEFAULT_PRIZE_WHEEL,
  DEFAULT_PROMO_CODES,
  type HeroBannerConfig,
  type PrizeWheelConfig,
  type PrizeWheelSegment,
  type PromoCodeItem,
  type TrackingRecord,
  type TrackingStage,
  type WheelAccent,
} from './src/data/catalog.ts';

interface ServerProduct {
  id: string;
  brand: string;
  category: string;
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

type RequestStatus = 'new' | 'in_progress' | 'done';

interface OrderSubmissionItem {
  productId: string;
  brand: string;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

interface OrderSubmission {
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
  items: OrderSubmissionItem[];
}

interface BuyoutSubmission {
  id: string;
  createdAt: string;
  status: RequestStatus;
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

interface ManagerInquiry {
  id: string;
  createdAt: string;
  status: RequestStatus;
  customerName: string;
  telegramHandle: string;
  topicLabel: string;
  message: string;
}

const PORT = Number(process.env.PORT) || 3000;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'svv-store.json');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {
  // Ignore if filesystem is temporarily read-only
}

const RAW_ENV_ADMIN_PASSCODE = (process.env.SVV_ADMIN_PASSCODE ?? '').trim();
const ENV_ADMIN_PASSCODE =
  RAW_ENV_ADMIN_PASSCODE === 'MY_ADMIN_PASSCODE' ? '' : RAW_ENV_ADMIN_PASSCODE;
let claimedAdminRecord: { salt: string; hashHex: string } | null = null;
const activeAdminTokens = new Set<string>();

const serverCatalogOverrides = new Map<string, ServerProduct>();
const deletedProductIds = new Set<string>();
const promoCodesMap = new Map<string, PromoCodeItem>(
  DEFAULT_PROMO_CODES.map((p) => [p.code, { ...p }])
);
let prizeWheelConfig: PrizeWheelConfig = {
  ...DEFAULT_PRIZE_WHEEL,
  segments: DEFAULT_PRIZE_WHEEL.segments.map((s) => ({ ...s })),
};
let heroBannerConfig: HeroBannerConfig = { ...DEFAULT_HERO_BANNER };
const orderSubmissions: OrderSubmission[] = [];
const buyoutRequests: BuyoutSubmission[] = [];
const managerInquiries: ManagerInquiry[] = [];
const trackingRecords: TrackingRecord[] = [];
const publicUploadRateMap = new Map<string, { count: number; resetAt: number }>();

function sanitizeStatus(raw: unknown): RequestStatus {
  if (raw === 'in_progress' || raw === 'done') return raw;
  return 'new';
}

const VALID_TRACKING_STAGES = new Set<TrackingStage>([
  'confirmed',
  'china_warehouse',
  'in_transit',
  'customs_arrived',
  'ready_delivered',
]);

function sanitizeTrackingStage(raw: unknown): TrackingStage {
  if (typeof raw === 'string' && VALID_TRACKING_STAGES.has(raw as TrackingStage)) {
    return raw as TrackingStage;
  }
  return 'confirmed';
}

function sanitizeTrackingRecord(raw: unknown): TrackingRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawId = typeof obj.id === 'string' ? obj.id.trim().slice(0, 80) : '';
  const id = rawId && /^[a-zA-Z0-9_-]+$/.test(rawId) ? rawId : `trk-${crypto.randomUUID().slice(0, 8)}`;
  const orderCode = typeof obj.orderCode === 'string' ? obj.orderCode.trim().slice(0, 48) : '';
  const rawHandle = typeof obj.telegramHandle === 'string' ? obj.telegramHandle.trim().slice(0, 40) : '';
  const itemTitle = typeof obj.itemTitle === 'string' ? obj.itemTitle.trim().slice(0, 160) : '';
  if (orderCode.length < 2 || !/^@?[a-zA-Z0-9_]{3,32}$/.test(rawHandle) || itemTitle.length < 2) {
    return null;
  }
  const telegramHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
  const rawImageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim().slice(0, 500) : '';
  const imageUrl =
    rawImageUrl && !rawImageUrl.startsWith('//') && (rawImageUrl.startsWith('/') || rawImageUrl.startsWith('https://'))
      ? rawImageUrl
      : '';

  return {
    id,
    orderCode,
    telegramHandle,
    itemTitle,
    imageUrl: imageUrl || undefined,
    stage: sanitizeTrackingStage(obj.stage),
    carrierTrack: typeof obj.carrierTrack === 'string' ? obj.carrierTrack.trim().slice(0, 80) : '',
    deliveryMethod: typeof obj.deliveryMethod === 'string' ? obj.deliveryMethod.trim().slice(0, 80) : '',
    etaLabel: typeof obj.etaLabel === 'string' ? obj.etaLabel.trim().slice(0, 80) : '',
    locationNote: typeof obj.locationNote === 'string' ? obj.locationNote.trim().slice(0, 280) : '',
    updatedAt:
      typeof obj.updatedAt === 'string' && obj.updatedAt.trim()
        ? obj.updatedAt.trim().slice(0, 60)
        : new Date().toISOString(),
  };
}

function sanitizeBanner(raw: unknown): HeroBannerConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const str = (key: keyof HeroBannerConfig, maxLen: number, fallback: string) =>
    typeof obj[key] === 'string' ? obj[key].trim().slice(0, maxLen) : fallback;

  const title = str('title', 60, DEFAULT_HERO_BANNER.title);
  const subtitle = str('subtitle', 140, DEFAULT_HERO_BANNER.subtitle);
  const primaryCtaLabel = str('primaryCtaLabel', 40, DEFAULT_HERO_BANNER.primaryCtaLabel);
  const secondaryCtaLabel = str('secondaryCtaLabel', 40, DEFAULT_HERO_BANNER.secondaryCtaLabel);
  if (
    title.length < 2 ||
    subtitle.length < 2 ||
    primaryCtaLabel.length < 2 ||
    secondaryCtaLabel.length < 2
  ) {
    return null;
  }

  const rawImageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim().slice(0, 500) : '';
  if (
    rawImageUrl &&
    (rawImageUrl.startsWith('//') ||
      (!rawImageUrl.startsWith('/') && !rawImageUrl.startsWith('https://')))
  ) {
    return null;
  }

  return {
    eyebrow: str('eyebrow', 80, DEFAULT_HERO_BANNER.eyebrow) || DEFAULT_HERO_BANNER.eyebrow,
    title,
    subtitle,
    description: str('description', 320, ''),
    primaryCtaLabel,
    secondaryCtaLabel,
    promoMetricLabel:
      str('promoMetricLabel', 40, DEFAULT_HERO_BANNER.promoMetricLabel) ||
      DEFAULT_HERO_BANNER.promoMetricLabel,
    promoMetricValue:
      str('promoMetricValue', 40, DEFAULT_HERO_BANNER.promoMetricValue) ||
      DEFAULT_HERO_BANNER.promoMetricValue,
    sealTop: str('sealTop', 18, DEFAULT_HERO_BANNER.sealTop) || DEFAULT_HERO_BANNER.sealTop,
    sealBottom:
      str('sealBottom', 18, DEFAULT_HERO_BANNER.sealBottom) || DEFAULT_HERO_BANNER.sealBottom,
    tickerOverride: str('tickerOverride', 280, ''),
    imageUrl: rawImageUrl,
  };
}

function loadNonSecretStore(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as {
      upserts?: ServerProduct[];
      deletedIds?: string[];
      promos?: PromoCodeItem[];
      wheel?: PrizeWheelConfig;
      banner?: HeroBannerConfig;
      adminCredential?: { salt: string; hashHex: string };
      orders?: OrderSubmission[];
      buyouts?: BuyoutSubmission[];
      inquiries?: ManagerInquiry[];
      tracking?: TrackingRecord[];
    };
    if (Array.isArray(parsed.upserts)) {
      for (const item of parsed.upserts) {
        const clean = sanitizeProduct(item);
        if (clean) serverCatalogOverrides.set(clean.id, clean);
      }
    }
    if (Array.isArray(parsed.deletedIds)) {
      for (const id of parsed.deletedIds) {
        if (typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id)) {
          deletedProductIds.add(id);
        }
      }
    }
    if (Array.isArray(parsed.promos) && parsed.promos.length > 0) {
      promoCodesMap.clear();
      for (const p of parsed.promos) {
        const clean = sanitizePromo(p);
        if (clean) promoCodesMap.set(clean.code, clean);
      }
    }
    if (parsed.wheel) {
      const cleanWheel = sanitizeWheel(parsed.wheel);
      if (cleanWheel) prizeWheelConfig = cleanWheel;
    }
    if (parsed.banner) {
      const cleanBanner = sanitizeBanner(parsed.banner);
      if (cleanBanner) heroBannerConfig = cleanBanner;
    }
    if (
      parsed.adminCredential &&
      typeof parsed.adminCredential.salt === 'string' &&
      typeof parsed.adminCredential.hashHex === 'string' &&
      /^[a-f0-9]{32}$/.test(parsed.adminCredential.salt) &&
      /^[a-f0-9]{128}$/.test(parsed.adminCredential.hashHex)
    ) {
      claimedAdminRecord = {
        salt: parsed.adminCredential.salt,
        hashHex: parsed.adminCredential.hashHex,
      };
    }
    if (Array.isArray(parsed.orders)) {
      for (const ord of parsed.orders.slice(0, 100)) {
        if (ord && typeof ord.id === 'string' && typeof ord.customerName === 'string' && Array.isArray(ord.items)) {
          orderSubmissions.push({
            ...ord,
            status: sanitizeStatus(ord.status),
          });
        }
      }
    }
    if (Array.isArray(parsed.buyouts)) {
      for (const b of parsed.buyouts.slice(0, 100)) {
        if (b && typeof b.id === 'string' && typeof b.sourceUrlOrName === 'string') {
          buyoutRequests.push({
            ...b,
            status: sanitizeStatus(b.status),
          });
        }
      }
    }
    if (Array.isArray(parsed.inquiries)) {
      for (const inq of parsed.inquiries.slice(0, 100)) {
        if (inq && typeof inq.id === 'string' && typeof inq.customerName === 'string') {
          managerInquiries.push({
            ...inq,
            status: sanitizeStatus(inq.status),
          });
        }
      }
    }
    if (Array.isArray(parsed.tracking)) {
      for (const trk of parsed.tracking.slice(0, 200)) {
        const clean = sanitizeTrackingRecord(trk);
        if (clean) trackingRecords.push(clean);
      }
    }
  } catch {
    // Ignore corrupted store file and keep defaults
  }
}

function saveNonSecretStore(): void {
  try {
    const payload = {
      upserts: Array.from(serverCatalogOverrides.values()),
      deletedIds: Array.from(deletedProductIds.values()),
      promos: Array.from(promoCodesMap.values()),
      wheel: prizeWheelConfig,
      banner: heroBannerConfig,
      adminCredential: claimedAdminRecord ?? undefined,
      orders: orderSubmissions.slice(0, 100),
      buyouts: buyoutRequests.slice(0, 100),
      inquiries: managerInquiries.slice(0, 100),
      tracking: trackingRecords.slice(0, 200),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // Ignore disk write issues
  }
}

function getAuthMode(): 'env' | 'claimed' | 'unclaimed' {
  if (claimedAdminRecord !== null) return 'claimed';
  if (ENV_ADMIN_PASSCODE.length > 0) return 'env';
  return 'unclaimed';
}

function hashPasscodeWithSalt(passcode: string, salt: string): Buffer {
  return crypto.scryptSync(passcode, salt, 64);
}

function verifyPasscodeAgainstEnv(candidate: string): boolean {
  if (!ENV_ADMIN_PASSCODE) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(ENV_ADMIN_PASSCODE).digest();
  return crypto.timingSafeEqual(a, b);
}

function verifyPasscodeAgainstClaimed(candidate: string): boolean {
  if (!claimedAdminRecord) return false;
  const derived = hashPasscodeWithSalt(candidate, claimedAdminRecord.salt);
  const expected = Buffer.from(claimedAdminRecord.hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function issueAdminToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeAdminTokens.add(token);
  if (activeAdminTokens.size > 20) {
    const oldest = activeAdminTokens.values().next().value;
    if (oldest) activeAdminTokens.delete(oldest);
  }
  return token;
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется вход по паролю администратора.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token || !activeAdminTokens.has(token)) {
    res.status(401).json({ error: 'Сессия администратора недействительна.' });
    return;
  }
  next();
}

function sanitizeProduct(raw: unknown): ServerProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 128) : '';
  const brand = typeof obj.brand === 'string' ? obj.brand.trim().slice(0, 80) : '';
  const category = typeof obj.category === 'string' ? obj.category.trim().slice(0, 60) : '';
  const name = typeof obj.name === 'string' ? obj.name.trim().slice(0, 140) : '';
  const price =
    typeof obj.price === 'number' && Number.isFinite(obj.price) ? Math.round(obj.price) : 0;
  const imageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim().slice(0, 500) : '';
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || !brand || !name || price <= 0 || !imageUrl) {
    return null;
  }
  if (!imageUrl.startsWith('/') && !imageUrl.startsWith('https://')) {
    return null;
  }
  const sizes = Array.isArray(obj.sizes)
    ? obj.sizes
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 10)
    : ['One Size'];
  return {
    id,
    brand,
    category: category || 'Худи и свитшоты',
    name,
    price,
    availability:
      typeof obj.availability === 'string' ? obj.availability.trim().slice(0, 60) : 'В наличии',
    imageUrl,
    sizes: sizes.length > 0 ? sizes : ['One Size'],
    composition: typeof obj.composition === 'string' ? obj.composition.trim().slice(0, 200) : '',
    origin: typeof obj.origin === 'string' ? obj.origin.trim().slice(0, 80) : 'Италия',
    stylistNote: typeof obj.stylistNote === 'string' ? obj.stylistNote.trim().slice(0, 400) : '',
    pairingTip: typeof obj.pairingTip === 'string' ? obj.pairingTip.trim().slice(0, 300) : '',
    order: typeof obj.order === 'number' && Number.isFinite(obj.order) ? obj.order : 100,
  };
}

function sanitizePromo(raw: unknown): PromoCodeItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const code =
    typeof obj.code === 'string'
      ? obj.code
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '')
          .slice(0, 24)
      : '';
  if (code.length < 3) return null;
  const discountType = obj.discountType === 'fixed' ? 'fixed' : 'percent';
  const rawVal =
    typeof obj.discountValue === 'number' && Number.isFinite(obj.discountValue)
      ? Math.round(obj.discountValue)
      : 0;
  if (rawVal <= 0) return null;
  if (discountType === 'percent' && rawVal > 90) return null;
  if (discountType === 'fixed' && rawVal > 500000) return null;
  const minSubtotal =
    typeof obj.minSubtotal === 'number' && Number.isFinite(obj.minSubtotal)
      ? Math.max(0, Math.round(obj.minSubtotal))
      : 0;
  const label = typeof obj.label === 'string' ? obj.label.trim().slice(0, 120) : '';
  const active = typeof obj.active === 'boolean' ? obj.active : true;
  return {
    code,
    discountType,
    discountValue: rawVal,
    minSubtotal,
    label,
    active,
  };
}

const VALID_ACCENTS = new Set<WheelAccent>(['obsidian', 'bone', 'smoke', 'crimson']);

function sanitizeWheel(raw: unknown): PrizeWheelConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const enabled = typeof obj.enabled === 'boolean' ? obj.enabled : true;
  const title =
    typeof obj.title === 'string' && obj.title.trim().length >= 2
      ? obj.title.trim().slice(0, 80)
      : DEFAULT_PRIZE_WHEEL.title;
  const subtitle =
    typeof obj.subtitle === 'string'
      ? obj.subtitle.trim().slice(0, 200)
      : DEFAULT_PRIZE_WHEEL.subtitle;
  if (!Array.isArray(obj.segments)) return null;

  const segments: PrizeWheelSegment[] = [];
  for (const item of obj.segments.slice(0, 10)) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    const rawId = typeof s.id === 'string' ? s.id.trim().slice(0, 64) : '';
    const id = rawId && /^[a-zA-Z0-9_-]+$/.test(rawId) ? rawId : `seg-${segments.length + 1}`;
    const label = typeof s.label === 'string' ? s.label.trim().slice(0, 60) : '';
    const shortLabel = typeof s.shortLabel === 'string' ? s.shortLabel.trim().slice(0, 18) : '';
    const promoCode =
      typeof s.promoCode === 'string'
        ? s.promoCode
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_-]/g, '')
            .slice(0, 24)
        : '';
    const description =
      typeof s.description === 'string' ? s.description.trim().slice(0, 200) : '';
    const weight =
      typeof s.weight === 'number' && Number.isFinite(s.weight)
        ? Math.min(100, Math.max(1, Math.round(s.weight)))
        : 10;
    const accent: WheelAccent = VALID_ACCENTS.has(s.accent as WheelAccent)
      ? (s.accent as WheelAccent)
      : 'obsidian';
    if (label.length >= 2 && shortLabel.length >= 1) {
      segments.push({ id, label, shortLabel, promoCode, description, weight, accent });
    }
  }
  if (segments.length < 2) return null;
  return { enabled, title, subtitle, segments };
}

loadNonSecretStore();

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR));

  app.get('/api/admin/status', (_req: Request, res: Response) => {
    res.json({ mode: getAuthMode() });
  });

  app.post('/api/admin/claim', (req: Request, res: Response) => {
    if (ENV_ADMIN_PASSCODE.length > 0) {
      res.status(409).json({ error: 'Пароль уже настроен на сервере.' });
      return;
    }
    if (claimedAdminRecord !== null) {
      res.status(409).json({ error: 'Пароль администратора уже активирован. Выполните вход.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (password.length < 4 || password.length > 128) {
      res.status(400).json({ error: 'Пароль должен содержать от 4 до 128 символов.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = hashPasscodeWithSalt(password, salt).toString('hex');
    claimedAdminRecord = { salt, hashHex };
    saveNonSecretStore();
    const token = issueAdminToken();
    res.status(201).json({ token, mode: 'claimed' });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const mode = getAuthMode();
    if (mode === 'unclaimed') {
      res.status(409).json({ error: 'Сначала активируйте пароль администратора.' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
    if (!password) {
      res.status(400).json({ error: 'Введите пароль администратора.' });
      return;
    }
    const ok =
      mode === 'env'
        ? verifyPasscodeAgainstEnv(password)
        : verifyPasscodeAgainstClaimed(password);
    if (!ok) {
      res.status(401).json({ error: 'Неверный пароль администратора.' });
      return;
    }
    const token = issueAdminToken();
    res.json({ token, mode });
  });

  app.post('/api/admin/change-password', requireAdminAuth, (req: Request, res: Response) => {
    const mode = getAuthMode();
    if (mode === 'unclaimed') {
      res.status(409).json({ error: 'Сначала активируйте пароль администратора.' });
      return;
    }
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
    const newPassword =
      typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

    if (!currentPassword) {
      res.status(400).json({ error: 'Введите текущий пароль администратора.' });
      return;
    }
    if (newPassword.length < 4 || newPassword.length > 128) {
      res.status(400).json({ error: 'Новый пароль должен содержать от 4 до 128 символов.' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'Новый пароль должен отличаться от текущего.' });
      return;
    }

    const currentValid =
      mode === 'claimed'
        ? verifyPasscodeAgainstClaimed(currentPassword)
        : verifyPasscodeAgainstEnv(currentPassword);
    if (!currentValid) {
      res.status(401).json({ error: 'Текущий пароль указан неверно.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = hashPasscodeWithSalt(newPassword, salt).toString('hex');
    claimedAdminRecord = { salt, hashHex };
    saveNonSecretStore();

    activeAdminTokens.clear();
    const token = issueAdminToken();
    res.json({
      token,
      mode: 'claimed',
      envConfigured: ENV_ADMIN_PASSCODE.length > 0,
    });
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      if (token) activeAdminTokens.delete(token);
    }
    res.json({ ok: true });
  });

  app.get('/api/catalog/overrides', (_req: Request, res: Response) => {
    res.json({
      upserts: Array.from(serverCatalogOverrides.values()),
      deletedIds: Array.from(deletedProductIds.values()),
    });
  });

  app.post('/api/catalog', requireAdminAuth, (req: Request, res: Response) => {
    const product = sanitizeProduct(req.body);
    if (!product) {
      res.status(400).json({ error: 'Некорректные данные позиции каталога.' });
      return;
    }
    deletedProductIds.delete(product.id);
    serverCatalogOverrides.set(product.id, product);
    saveNonSecretStore();
    res.status(201).json({ product });
  });

  app.delete('/api/catalog/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      res.status(400).json({ error: 'Некорректный ID позиции.' });
      return;
    }
    serverCatalogOverrides.delete(id);
    deletedProductIds.add(id);
    saveNonSecretStore();
    res.json({ deletedId: id });
  });

  app.get('/api/promos', (_req: Request, res: Response) => {
    const active = Array.from(promoCodesMap.values()).filter((p) => p.active);
    res.json({ promos: active });
  });

  app.get('/api/admin/promos', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ promos: Array.from(promoCodesMap.values()) });
  });

  app.post('/api/promos', requireAdminAuth, (req: Request, res: Response) => {
    const promo = sanitizePromo(req.body);
    if (!promo) {
      res.status(400).json({ error: 'Проверьте код (3–24 латинских символа) и размер скидки.' });
      return;
    }
    promoCodesMap.set(promo.code, promo);
    saveNonSecretStore();
    res.status(201).json({ promo });
  });

  app.patch('/api/promos/:code', requireAdminAuth, (req: Request, res: Response) => {
    const rawCode = typeof req.params.code === 'string' ? req.params.code.trim().toUpperCase() : '';
    const existing = promoCodesMap.get(rawCode);
    if (!existing) {
      res.status(404).json({ error: 'Промокод не найден.' });
      return;
    }
    const nextActive = typeof req.body?.active === 'boolean' ? req.body.active : !existing.active;
    const updated = { ...existing, active: nextActive };
    promoCodesMap.set(rawCode, updated);
    saveNonSecretStore();
    res.json({ promo: updated });
  });

  app.delete('/api/promos/:code', requireAdminAuth, (req: Request, res: Response) => {
    const rawCode = typeof req.params.code === 'string' ? req.params.code.trim().toUpperCase() : '';
    if (!rawCode || !promoCodesMap.has(rawCode)) {
      res.status(404).json({ error: 'Промокод не найден.' });
      return;
    }
    promoCodesMap.delete(rawCode);
    saveNonSecretStore();
    res.json({ deletedCode: rawCode });
  });

  app.get('/api/wheel', (_req: Request, res: Response) => {
    res.json({ wheel: prizeWheelConfig });
  });

  app.put('/api/wheel', requireAdminAuth, (req: Request, res: Response) => {
    const nextWheel = sanitizeWheel(req.body);
    if (!nextWheel) {
      res.status(400).json({ error: 'Проверьте заголовок и сектора колеса (от 2 до 10).' });
      return;
    }
    prizeWheelConfig = nextWheel;
    saveNonSecretStore();
    res.json({ wheel: prizeWheelConfig });
  });

  app.get('/api/banner', (_req: Request, res: Response) => {
    res.json({ banner: heroBannerConfig });
  });

  app.put('/api/banner', requireAdminAuth, (req: Request, res: Response) => {
    const nextBanner = sanitizeBanner(req.body);
    if (!nextBanner) {
      res.status(400).json({
        error: 'Проверьте заголовок, подзаголовок, кнопки и ссылку на фон баннера.',
      });
      return;
    }
    heroBannerConfig = nextBanner;
    saveNonSecretStore();
    res.json({ banner: heroBannerConfig });
  });

  function saveUploadedDataUrl(dataUrl: string): { url?: string; error?: string } {
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      return { error: 'Поддерживаются только изображения JPG, PNG или WEBP.' };
    }
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buf = Buffer.from(match[2], 'base64');
    if (buf.length === 0 || buf.length > 3 * 1024 * 1024) {
      return { error: 'Размер фото не должен превышать 3 МБ.' };
    }

    const isJpg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng =
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;
    const isWebp =
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP';

    if ((ext === 'jpg' && !isJpg) || (ext === 'png' && !isPng) || (ext === 'webp' && !isWebp)) {
      return { error: 'Содержимое файла не соответствует формату изображения.' };
    }

    const filename = `svv-${crypto.randomUUID()}.${ext}`;
    const targetPath = path.resolve(UPLOAD_DIR, filename);
    if (!targetPath.startsWith(UPLOAD_DIR + path.sep)) {
      return { error: 'Некорректный путь сохранения.' };
    }
    fs.writeFileSync(targetPath, buf);
    return { url: `/uploads/${filename}` };
  }

  app.post('/api/upload', requireAdminAuth, (req: Request, res: Response) => {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const saved = saveUploadedDataUrl(dataUrl);
    if (!saved.url) {
      res.status(400).json({ error: saved.error || 'Ошибка загрузки фото.' });
      return;
    }
    res.status(201).json({ url: saved.url });
  });

  app.post('/api/buyouts/upload', (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    const now = Date.now();
    const bucket = publicUploadRateMap.get(clientIp);
    if (bucket && bucket.resetAt > now) {
      if (bucket.count >= 20) {
        res.status(429).json({ error: 'Слишком много загрузок. Попробуйте позже.' });
        return;
      }
      bucket.count += 1;
    } else {
      publicUploadRateMap.set(clientIp, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const saved = saveUploadedDataUrl(dataUrl);
    if (!saved.url) {
      res.status(400).json({ error: saved.error || 'Ошибка загрузки фото.' });
      return;
    }
    res.status(201).json({ url: saved.url });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const customerName =
      typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 80) : '';
    const telegramHandle =
      typeof body?.telegramHandle === 'string' ? body.telegramHandle.trim().slice(0, 40) : '';
    const deliveryTitle =
      typeof body?.deliveryTitle === 'string' ? body.deliveryTitle.trim().slice(0, 80) : '';
    const deliveryAddress =
      typeof body?.deliveryAddress === 'string' ? body.deliveryAddress.trim().slice(0, 200) : '';
    const deliveryPrice =
      typeof body?.deliveryPrice === 'number' && Number.isFinite(body.deliveryPrice)
        ? Math.max(0, Math.round(body.deliveryPrice))
        : 0;
    const paymentMethod = body?.paymentMethod === 'invoice' ? 'invoice' : 'concierge';
    const promoCode =
      typeof body?.promoCode === 'string'
        ? body.promoCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24)
        : '';
    const discountAmount =
      typeof body?.discountAmount === 'number' && Number.isFinite(body.discountAmount)
        ? Math.max(0, Math.round(body.discountAmount))
        : 0;

    if (customerName.length < 2 || !/^@?[a-zA-Z0-9_]{3,32}$/.test(telegramHandle)) {
      res.status(400).json({ error: 'Укажите имя получателя и корректный Telegram @username.' });
      return;
    }

    const rawItems = Array.isArray(body?.items) ? body.items.slice(0, 30) : [];
    const items: OrderSubmissionItem[] = [];
    for (const entry of rawItems) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const productId = typeof e.productId === 'string' ? e.productId.trim().slice(0, 128) : '';
      const brand = typeof e.brand === 'string' ? e.brand.trim().slice(0, 80) : '';
      const name = typeof e.name === 'string' ? e.name.trim().slice(0, 140) : '';
      const size = typeof e.size === 'string' ? e.size.trim().slice(0, 40) : 'One Size';
      const quantity =
        typeof e.quantity === 'number' && Number.isFinite(e.quantity)
          ? Math.min(50, Math.max(1, Math.round(e.quantity)))
          : 1;
      const unitPrice =
        typeof e.unitPrice === 'number' && Number.isFinite(e.unitPrice)
          ? Math.max(1, Math.round(e.unitPrice))
          : 0;
      if (brand && name && unitPrice > 0) {
        items.push({ productId: productId || 'item', brand, name, size, quantity, unitPrice });
      }
    }

    if (items.length === 0) {
      res.status(400).json({ error: 'Корзина заказа пуста.' });
      return;
    }

    const subtotalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const totalAmount = Math.max(0, subtotalAmount - discountAmount + deliveryPrice);

    const order: OrderSubmission = {
      id: `SVV-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
      customerName,
      telegramHandle: telegramHandle.startsWith('@') ? telegramHandle : `@${telegramHandle}`,
      deliveryTitle: deliveryTitle || 'Доставка SVV',
      deliveryAddress: deliveryAddress || 'Шоурум SVV SHOP',
      deliveryPrice,
      paymentMethod,
      promoCode: promoCode || undefined,
      discountAmount,
      subtotalAmount,
      totalAmount,
      items,
    };

    orderSubmissions.unshift(order);
    if (orderSubmissions.length > 100) orderSubmissions.pop();

    const firstProd = serverCatalogOverrides.get(items[0].productId);
    trackingRecords.unshift({
      id: `trk-${order.id.toLowerCase()}`,
      orderCode: order.id,
      telegramHandle: order.telegramHandle,
      itemTitle:
        items.length === 1
          ? `${items[0].brand} · ${items[0].name} (${items[0].size})`
          : `${items[0].brand} · ${items[0].name} (+ ещё ${items.length - 1})`,
      imageUrl: firstProd?.imageUrl,
      stage: 'confirmed',
      carrierTrack: '',
      deliveryMethod: order.deliveryTitle,
      etaLabel: '',
      locationNote: 'Заказ оформлен, ожидает подтверждения менеджером.',
      updatedAt: order.createdAt,
    });
    if (trackingRecords.length > 200) trackingRecords.pop();

    saveNonSecretStore();
    res.status(201).json({ order });
  });

  app.get('/api/orders', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ orders: orderSubmissions });
  });

  app.post('/api/buyouts', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const rawBuyoutLink =
      typeof body?.buyoutLink === 'string' ? body.buyoutLink.trim().slice(0, 500) : '';
    const buyoutLink =
      rawBuyoutLink &&
      (rawBuyoutLink.startsWith('https://') || rawBuyoutLink.startsWith('http://'))
        ? rawBuyoutLink
        : '';
    const sourceUrlOrName =
      typeof body?.sourceUrlOrName === 'string' ? body.sourceUrlOrName.trim().slice(0, 400) : '';
    const brand = typeof body?.brand === 'string' ? body.brand.trim().slice(0, 80) : '';
    const size = typeof body?.size === 'string' ? body.size.trim().slice(0, 40) : '';
    const telegramHandle =
      typeof body?.telegramHandle === 'string' ? body.telegramHandle.trim().slice(0, 40) : '';
    const priceCny =
      typeof body?.priceCny === 'number' && Number.isFinite(body.priceCny)
        ? Math.round(body.priceCny)
        : 0;
    const estimatedRub =
      typeof body?.estimatedRub === 'number' && Number.isFinite(body.estimatedRub)
        ? Math.round(body.estimatedRub)
        : 0;
    const shippingSpeed = body?.shippingSpeed === 'cargo' ? 'cargo' : 'air';
    const shippingUsd =
      typeof body?.shippingUsd === 'number' && Number.isFinite(body.shippingUsd)
        ? Math.max(0, Math.round(body.shippingUsd))
        : shippingSpeed === 'air'
        ? 45
        : 0;
    const weightKg =
      typeof body?.weightKg === 'number' && Number.isFinite(body.weightKg)
        ? Math.min(50, Math.max(0.5, Math.round(body.weightKg * 10) / 10))
        : undefined;
    const rawImageUrl =
      typeof body?.imageUrl === 'string' ? body.imageUrl.trim().slice(0, 500) : '';
    const imageUrl =
      rawImageUrl &&
      !rawImageUrl.startsWith('//') &&
      (rawImageUrl.startsWith('/') || rawImageUrl.startsWith('https://'))
        ? rawImageUrl
        : '';
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 400) : '';

    if (
      (!buyoutLink && sourceUrlOrName.length < 3) ||
      (rawBuyoutLink && !buyoutLink) ||
      priceCny <= 0 ||
      !/^@?[a-zA-Z0-9_]{3,32}$/.test(telegramHandle)
    ) {
      res.status(400).json({ error: 'Проверьте ссылку/название, цену в юанях и @username.' });
      return;
    }

    const normalizedHandle = telegramHandle.startsWith('@')
      ? telegramHandle
      : `@${telegramHandle}`;
    const displayLabel = sourceUrlOrName || buyoutLink;
    const submission: BuyoutSubmission = {
      id: `CN-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
      buyoutLink: buyoutLink || undefined,
      sourceUrlOrName: displayLabel,
      brand: brand || 'Выкуп из Китая',
      size: size || 'Уточнить',
      priceCny,
      estimatedRub,
      shippingUsd,
      weightKg,
      shippingSpeed,
      telegramHandle: normalizedHandle,
      imageUrl: imageUrl || undefined,
      notes,
    };
    buyoutRequests.unshift(submission);
    if (buyoutRequests.length > 100) buyoutRequests.pop();

    trackingRecords.unshift({
      id: `trk-${submission.id.toLowerCase()}`,
      orderCode: submission.id,
      telegramHandle: normalizedHandle,
      itemTitle: `${submission.brand} — ${displayLabel} (${submission.size})`.slice(0, 160),
      imageUrl: imageUrl || undefined,
      stage: 'confirmed',
      carrierTrack: '',
      deliveryMethod: shippingSpeed === 'air' ? 'Авиа ($45)' : `Карго авто (${weightKg ?? 1} кг)`,
      etaLabel: shippingSpeed === 'air' ? '7–12 дней' : '16–24 дня',
      locationNote: 'Заявка на выкуп принята, ожидает обработки менеджером.',
      updatedAt: submission.createdAt,
    });
    if (trackingRecords.length > 200) trackingRecords.pop();

    saveNonSecretStore();
    res.status(201).json({ submission });
  });

  app.get('/api/buyouts', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ buyouts: buyoutRequests });
  });

  app.get('/api/tracking', (req: Request, res: Response) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (rawQ.length < 2) {
      res.json({ records: [] });
      return;
    }
    const qLower = rawQ.toLowerCase();
    const qHandle = qLower.startsWith('@') ? qLower : `@${qLower}`;
    const matches = trackingRecords.filter((rec) => {
      const codeMatch = rec.orderCode.toLowerCase() === qLower;
      const trackMatch = rec.carrierTrack && rec.carrierTrack.toLowerCase() === qLower;
      const handleMatch = rec.telegramHandle.toLowerCase() === qHandle;
      return codeMatch || trackMatch || handleMatch;
    });
    res.json({ records: matches });
  });

  app.get('/api/admin/tracking', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ records: trackingRecords });
  });

  app.post('/api/admin/tracking', requireAdminAuth, (req: Request, res: Response) => {
    const record = sanitizeTrackingRecord(req.body);
    if (!record) {
      res.status(400).json({ error: 'Проверьте код заказа, @username клиента и название товара.' });
      return;
    }
    record.updatedAt = new Date().toISOString();
    const existingIdx = trackingRecords.findIndex(
      (r) =>
        r.id === record.id ||
        r.orderCode.toLowerCase() === record.orderCode.toLowerCase()
    );
    if (existingIdx >= 0) {
      trackingRecords[existingIdx] = {
        ...record,
        id: trackingRecords[existingIdx].id,
      };
    } else {
      trackingRecords.unshift(record);
      if (trackingRecords.length > 200) trackingRecords.pop();
    }
    saveNonSecretStore();
    const saved = existingIdx >= 0 ? trackingRecords[existingIdx] : record;
    res.status(existingIdx >= 0 ? 200 : 201).json({ record: saved });
  });

  app.delete('/api/admin/tracking/:id', requireAdminAuth, (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const idx = trackingRecords.findIndex((r) => r.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Запись трекинга не найдена.' });
      return;
    }
    trackingRecords.splice(idx, 1);
    saveNonSecretStore();
    res.json({ deletedId: id });
  });

  app.post('/api/inquiries', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const customerName =
      typeof body?.customerName === 'string' ? body.customerName.trim().slice(0, 80) : '';
    const telegramHandle =
      typeof body?.telegramHandle === 'string' ? body.telegramHandle.trim().slice(0, 40) : '';
    const topicLabel =
      typeof body?.topicLabel === 'string' ? body.topicLabel.trim().slice(0, 120) : '';
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '';

    if (customerName.length < 2 || !/^@?[a-zA-Z0-9_]{3,32}$/.test(telegramHandle)) {
      res.status(400).json({ error: 'Укажите имя и корректный Telegram @username.' });
      return;
    }

    const inquiry: ManagerInquiry = {
      id: `MGR-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      status: 'new',
      customerName,
      telegramHandle: telegramHandle.startsWith('@') ? telegramHandle : `@${telegramHandle}`,
      topicLabel: topicLabel || 'Вопрос по заказу',
      message,
    };
    managerInquiries.unshift(inquiry);
    if (managerInquiries.length > 100) managerInquiries.pop();
    saveNonSecretStore();
    res.status(201).json({ inquiry });
  });

  app.get('/api/inquiries', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({ inquiries: managerInquiries });
  });

  app.get('/api/inbox/summary', (_req: Request, res: Response) => {
    const newOrdersCount = orderSubmissions.filter((o) => o.status === 'new').length;
    const newBuyoutsCount = buyoutRequests.filter((b) => b.status === 'new').length;
    const newInquiriesCount = managerInquiries.filter((i) => i.status === 'new').length;
    res.json({
      newOrdersCount,
      newBuyoutsCount,
      newInquiriesCount,
      newTotalCount: newOrdersCount + newBuyoutsCount + newInquiriesCount,
    });
  });

  app.get('/api/inbox', requireAdminAuth, (_req: Request, res: Response) => {
    res.json({
      orders: orderSubmissions,
      buyouts: buyoutRequests,
      inquiries: managerInquiries,
    });
  });

  app.patch('/api/inbox/:type/:id/status', requireAdminAuth, (req: Request, res: Response) => {
    const type = typeof req.params.type === 'string' ? req.params.type.trim() : '';
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const status = sanitizeStatus(req.body?.status);

    const targetList =
      type === 'orders'
        ? orderSubmissions
        : type === 'buyouts'
        ? buyoutRequests
        : type === 'inquiries'
        ? managerInquiries
        : null;

    if (!targetList || !id) {
      res.status(400).json({ error: 'Некорректные параметры заявки.' });
      return;
    }

    const found = targetList.find((item) => item.id === id);
    if (!found) {
      res.status(404).json({ error: 'Заявка не найдена.' });
      return;
    }

    found.status = status;
    saveNonSecretStore();
    res.json({ id, status });
  });

  app.delete('/api/inbox/:type/:id', requireAdminAuth, (req: Request, res: Response) => {
    const type = typeof req.params.type === 'string' ? req.params.type.trim() : '';
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';

    const targetList =
      type === 'orders'
        ? orderSubmissions
        : type === 'buyouts'
        ? buyoutRequests
        : type === 'inquiries'
        ? managerInquiries
        : null;

    if (!targetList || !id) {
      res.status(400).json({ error: 'Некорректные параметры заявки.' });
      return;
    }

    const idx = targetList.findIndex((item) => item.id === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Заявка не найдена.' });
      return;
    }

    targetList.splice(idx, 1);
    saveNonSecretStore();
    res.json({ deletedId: id });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SVV SHOP server listening on port ${PORT}`);
  });
}

void createApp();
