import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_HERO_BANNER,
  DEFAULT_PRIZE_WHEEL,
  type HeroBannerConfig,
  type LuxuryProduct,
  type PrizeWheelConfig,
  type PrizeWheelSegment,
  type PromoCodeItem,
  type WheelAccent,
} from '../data/catalog';
import { OperationType, handleFirestoreError } from '../utils/firestoreError';

const PRODUCTS_COLLECTION = 'svvProducts';
const BANNER_COLLECTION = 'svvBanner';
const WHEEL_COLLECTION = 'svvWheel';
const PROMOS_COLLECTION = 'svvPromos';
const SINGLETON_DOC_ID = 'main';

const VALID_WHEEL_ACCENTS = new Set<WheelAccent>(['obsidian', 'bone', 'smoke', 'crimson']);

export function subscribeCatalogProducts(
  onUpdate: (products: LuxuryProduct[], hasRemoteData: boolean) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list: LuxuryProduct[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id ?? d.id),
          brand: String(data.brand ?? ''),
          category: (data.category as LuxuryProduct['category']) ?? 'Худи и свитшоты',
          name: String(data.name ?? ''),
          price: Number(data.price ?? 0),
          availability: String(data.availability ?? 'В наличии'),
          imageUrl: String(data.imageUrl ?? ''),
          sizes: Array.isArray(data.sizes) ? data.sizes.map(String) : ['One Size'],
          composition: String(data.composition ?? ''),
          origin: String(data.origin ?? ''),
          stylistNote: String(data.stylistNote ?? ''),
          pairingTip: String(data.pairingTip ?? ''),
          order: Number(data.order ?? 0),
        };
      });
      onUpdate(list, !snap.empty);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
    }
  );
}

export async function checkIsAdminUser(
  uid: string,
  email: string | null | undefined,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified) return false;
  if (email?.toLowerCase() === 'osigur462@gmail.com') return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

function toFirestoreProductPayload(product: LuxuryProduct, uid: string, createdAtValue: unknown) {
  return {
    id: product.id.trim().slice(0, 128),
    brand: product.brand.trim().slice(0, 80),
    category: String(product.category).trim().slice(0, 60) || 'Худи и свитшоты',
    name: product.name.trim().slice(0, 140),
    price: Math.min(100000000, Math.max(1, Math.round(product.price))),
    availability: product.availability.trim().slice(0, 60) || 'В наличии',
    imageUrl: product.imageUrl.trim().slice(0, 500),
    sizes:
      product.sizes.length > 0
        ? product.sizes.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
        : ['One Size'],
    composition: product.composition.trim().slice(0, 200),
    origin: product.origin.trim().slice(0, 80),
    stylistNote: product.stylistNote.trim().slice(0, 400),
    pairingTip: product.pairingTip.trim().slice(0, 300),
    order:
      typeof product.order === 'number' && Number.isFinite(product.order)
        ? Math.min(10000, Math.max(0, Math.round(product.order)))
        : 100,
    createdAt: createdAtValue,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  };
}

export async function saveProductToFirestore(
  product: LuxuryProduct,
  uid: string,
  isNew: boolean
): Promise<void> {
  const docPath = `${PRODUCTS_COLLECTION}/${product.id}`;
  const ref = doc(db, PRODUCTS_COLLECTION, product.id);
  try {
    const existing = isNew ? null : await getDoc(ref);
    const createdAtValue =
      existing && existing.exists() && existing.data().createdAt
        ? existing.data().createdAt
        : serverTimestamp();

    await setDoc(ref, toFirestoreProductPayload(product, uid, createdAtValue));
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const docPath = `${PRODUCTS_COLLECTION}/${productId}`;
  try {
    await deleteDoc(doc(db, PRODUCTS_COLLECTION, productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function syncProductsBatchToFirestore(
  items: LuxuryProduct[],
  uid: string
): Promise<number> {
  if (items.length === 0) return 0;
  try {
    const batch = writeBatch(db);
    let count = 0;
    for (const product of items) {
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(product.id)) continue;
      const ref = doc(db, PRODUCTS_COLLECTION, product.id);
      const existing = await getDoc(ref);
      const createdAtValue =
        existing.exists() && existing.data().createdAt
          ? existing.data().createdAt
          : serverTimestamp();
      batch.set(ref, toFirestoreProductPayload(product, uid, createdAtValue));
      count += 1;
    }
    if (count > 0) {
      await batch.commit();
    }
    return count;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, PRODUCTS_COLLECTION);
  }
}

export function subscribeHeroBanner(
  onUpdate: (banner: HeroBannerConfig) => void,
  onError?: (err: unknown) => void
): () => void {
  const docPath = `${BANNER_COLLECTION}/${SINGLETON_DOC_ID}`;
  return onSnapshot(
    doc(db, BANNER_COLLECTION, SINGLETON_DOC_ID),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onUpdate({
        eyebrow: String(data.eyebrow ?? DEFAULT_HERO_BANNER.eyebrow),
        title: String(data.title ?? DEFAULT_HERO_BANNER.title),
        subtitle: String(data.subtitle ?? DEFAULT_HERO_BANNER.subtitle),
        description: String(data.description ?? ''),
        primaryCtaLabel: String(data.primaryCtaLabel ?? DEFAULT_HERO_BANNER.primaryCtaLabel),
        secondaryCtaLabel: String(data.secondaryCtaLabel ?? DEFAULT_HERO_BANNER.secondaryCtaLabel),
        promoMetricLabel: String(data.promoMetricLabel ?? DEFAULT_HERO_BANNER.promoMetricLabel),
        promoMetricValue: String(data.promoMetricValue ?? DEFAULT_HERO_BANNER.promoMetricValue),
        sealTop: String(data.sealTop ?? DEFAULT_HERO_BANNER.sealTop),
        sealBottom: String(data.sealBottom ?? DEFAULT_HERO_BANNER.sealBottom),
        tickerOverride: String(data.tickerOverride ?? ''),
        imageUrl: String(data.imageUrl ?? ''),
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  );
}

export async function saveHeroBannerToFirestore(
  banner: HeroBannerConfig,
  uid: string
): Promise<void> {
  const docPath = `${BANNER_COLLECTION}/${SINGLETON_DOC_ID}`;
  const ref = doc(db, BANNER_COLLECTION, SINGLETON_DOC_ID);
  try {
    const existing = await getDoc(ref);
    const createdAtValue =
      existing.exists() && existing.data().createdAt
        ? existing.data().createdAt
        : serverTimestamp();
    await setDoc(ref, {
      eyebrow: (banner.eyebrow.trim() || DEFAULT_HERO_BANNER.eyebrow).slice(0, 80),
      title: banner.title.trim().slice(0, 60),
      subtitle: banner.subtitle.trim().slice(0, 140),
      description: banner.description.trim().slice(0, 320),
      primaryCtaLabel: banner.primaryCtaLabel.trim().slice(0, 40),
      secondaryCtaLabel: banner.secondaryCtaLabel.trim().slice(0, 40),
      promoMetricLabel: (banner.promoMetricLabel.trim() || DEFAULT_HERO_BANNER.promoMetricLabel).slice(0, 40),
      promoMetricValue: (banner.promoMetricValue.trim() || DEFAULT_HERO_BANNER.promoMetricValue).slice(0, 40),
      sealTop: (banner.sealTop.trim() || DEFAULT_HERO_BANNER.sealTop).slice(0, 18),
      sealBottom: (banner.sealBottom.trim() || DEFAULT_HERO_BANNER.sealBottom).slice(0, 18),
      tickerOverride: banner.tickerOverride.trim().slice(0, 280),
      imageUrl: banner.imageUrl.trim().slice(0, 500),
      createdAt: createdAtValue,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function subscribePrizeWheel(
  onUpdate: (wheel: PrizeWheelConfig) => void,
  onError?: (err: unknown) => void
): () => void {
  const docPath = `${WHEEL_COLLECTION}/${SINGLETON_DOC_ID}`;
  return onSnapshot(
    doc(db, WHEEL_COLLECTION, SINGLETON_DOC_ID),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const rawSegments = Array.isArray(data.segments) ? data.segments : [];
      const segments: PrizeWheelSegment[] = rawSegments
        .slice(0, 10)
        .map((item: Record<string, unknown>, idx: number) => ({
          id: String(item.id ?? `seg-${idx + 1}`),
          label: String(item.label ?? ''),
          shortLabel: String(item.shortLabel ?? ''),
          promoCode: String(item.promoCode ?? ''),
          description: String(item.description ?? ''),
          weight: Number(item.weight ?? 10),
          accent: VALID_WHEEL_ACCENTS.has(item.accent as WheelAccent)
            ? (item.accent as WheelAccent)
            : 'obsidian',
        }))
        .filter((s) => s.label.length >= 2 && s.shortLabel.length >= 1);

      if (segments.length >= 2) {
        onUpdate({
          enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
          title: String(data.title ?? DEFAULT_PRIZE_WHEEL.title),
          subtitle: String(data.subtitle ?? DEFAULT_PRIZE_WHEEL.subtitle),
          segments,
        });
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, docPath);
    }
  );
}

export async function savePrizeWheelToFirestore(
  wheel: PrizeWheelConfig,
  uid: string
): Promise<void> {
  const docPath = `${WHEEL_COLLECTION}/${SINGLETON_DOC_ID}`;
  const ref = doc(db, WHEEL_COLLECTION, SINGLETON_DOC_ID);
  try {
    const existing = await getDoc(ref);
    const createdAtValue =
      existing.exists() && existing.data().createdAt
        ? existing.data().createdAt
        : serverTimestamp();
    const cleanSegments = wheel.segments.slice(0, 10).map((s, idx) => ({
      id: (s.id || `seg-${idx + 1}`).slice(0, 64),
      label: s.label.trim().slice(0, 60),
      shortLabel: s.shortLabel.trim().slice(0, 18),
      promoCode: s.promoCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24),
      description: s.description.trim().slice(0, 200),
      weight: Math.min(100, Math.max(1, Math.round(s.weight))),
      accent: VALID_WHEEL_ACCENTS.has(s.accent) ? s.accent : 'obsidian',
    }));

    await setDoc(ref, {
      enabled: Boolean(wheel.enabled),
      title: wheel.title.trim().slice(0, 80),
      subtitle: wheel.subtitle.trim().slice(0, 200),
      segments: cleanSegments,
      createdAt: createdAtValue,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export function subscribePromoCodes(
  onUpdate: (promos: PromoCodeItem[], hasRemoteData: boolean) => void,
  onError?: (err: unknown) => void
): () => void {
  return onSnapshot(
    collection(db, PROMOS_COLLECTION),
    (snap) => {
      if (snap.empty) {
        onUpdate([], false);
        return;
      }
      const list: PromoCodeItem[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          code: String(data.code ?? d.id),
          discountType: data.discountType === 'fixed' ? 'fixed' : 'percent',
          discountValue: Number(data.discountValue ?? 0),
          minSubtotal: Number(data.minSubtotal ?? 0),
          label: String(data.label ?? ''),
          active: typeof data.active === 'boolean' ? data.active : true,
        };
      });
      onUpdate(list, true);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, PROMOS_COLLECTION);
    }
  );
}

export async function savePromoCodeToFirestore(
  promo: PromoCodeItem,
  uid: string
): Promise<void> {
  const cleanCode = promo.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
  const docPath = `${PROMOS_COLLECTION}/${cleanCode}`;
  const ref = doc(db, PROMOS_COLLECTION, cleanCode);
  try {
    const existing = await getDoc(ref);
    const createdAtValue =
      existing.exists() && existing.data().createdAt
        ? existing.data().createdAt
        : serverTimestamp();
    await setDoc(ref, {
      code: cleanCode,
      discountType: promo.discountType === 'fixed' ? 'fixed' : 'percent',
      discountValue: Math.min(500000, Math.max(1, Math.round(promo.discountValue))),
      minSubtotal: Math.min(10000000, Math.max(0, Math.round(promo.minSubtotal))),
      label: promo.label.trim().slice(0, 120),
      active: Boolean(promo.active),
      createdAt: createdAtValue,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function deletePromoCodeFromFirestore(code: string): Promise<void> {
  const cleanCode = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
  const docPath = `${PROMOS_COLLECTION}/${cleanCode}`;
  try {
    await deleteDoc(doc(db, PROMOS_COLLECTION, cleanCode));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
