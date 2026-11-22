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
import { LUXURY_PRODUCTS, type LuxuryProduct } from '../data/catalog';
import { OperationType, handleFirestoreError } from '../utils/firestoreError';

const COLLECTION = 'svvProducts';

export function subscribeCatalogProducts(
  onUpdate: (products: LuxuryProduct[], hasRemoteData: boolean) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onUpdate(LUXURY_PRODUCTS, false);
        return;
      }
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
      onUpdate(list, true);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION);
    }
  );
}

export async function checkIsAdminUser(uid: string, email: string | null | undefined, emailVerified: boolean): Promise<boolean> {
  if (!emailVerified) return false;
  if (email?.toLowerCase() === 'osigur462@gmail.com') return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function saveProductToFirestore(
  product: LuxuryProduct,
  uid: string,
  isNew: boolean
): Promise<void> {
  const path = `${COLLECTION}/${product.id}`;
  const ref = doc(db, COLLECTION, product.id);
  try {
    const existing = isNew ? null : await getDoc(ref);
    const createdAtValue =
      existing && existing.exists() && existing.data().createdAt
        ? existing.data().createdAt
        : serverTimestamp();

    await setDoc(ref, {
      id: product.id,
      brand: product.brand.trim().slice(0, 80),
      category: product.category,
      name: product.name.trim().slice(0, 140),
      price: Math.max(1, Math.round(product.price)),
      availability: product.availability.trim().slice(0, 60) || 'В наличии',
      imageUrl: product.imageUrl.trim().slice(0, 500),
      sizes: product.sizes.length > 0 ? product.sizes.slice(0, 10) : ['One Size'],
      composition: product.composition.trim().slice(0, 200),
      origin: product.origin.trim().slice(0, 80),
      stylistNote: product.stylistNote.trim().slice(0, 400),
      pairingTip: product.pairingTip.trim().slice(0, 300),
      order: typeof product.order === 'number' ? product.order : 100,
      createdAt: createdAtValue,
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
    });
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `${COLLECTION}/${productId}`;
  try {
    await deleteDoc(doc(db, COLLECTION, productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultProductsToFirestore(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    LUXURY_PRODUCTS.forEach((product, idx) => {
      const ref = doc(db, COLLECTION, product.id);
      batch.set(ref, {
        id: product.id,
        brand: product.brand,
        category: product.category,
        name: product.name,
        price: product.price,
        availability: product.availability,
        imageUrl: product.imageUrl,
        sizes: product.sizes,
        composition: product.composition,
        origin: product.origin,
        stylistNote: product.stylistNote,
        pairingTip: product.pairingTip,
        order: idx + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: uid,
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTION);
  }
}
