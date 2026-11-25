import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, ExternalLink, Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import {
  DELIVERY_OPTIONS,
  MANAGER_TELEGRAM_HANDLE,
  type DeliveryOption,
  type LuxuryProduct,
  type PromoCodeItem,
} from '../data/catalog';
import {
  applyPromoCode,
  calculateCartSubtotal,
  calculateOrderTotal,
  formatRub,
  getDeliveryOption,
  normalizeTelegramHandle,
  validateCheckoutInput,
  type CartItem,
  type OrderReceipt,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';

interface CartDrawerProps {
  isOpen: boolean;
  products: LuxuryProduct[];
  promoCodes: PromoCodeItem[];
  preselectedPromoCode?: string;
  cart: CartItem[];
  defaultName: string;
  defaultHandle: string;
  lastOrder: OrderReceipt | null;
  onClose: () => void;
  onUpdateQty: (productId: string, size: string, delta: number) => void;
  onOrderConfirmed: (receipt: OrderReceipt) => void;
  onClearReceipt: () => void;
  onGoToTracking?: (orderCode: string) => void;
}

export function CartDrawer({
  isOpen,
  products,
  promoCodes,
  preselectedPromoCode = '',
  cart,
  defaultName,
  defaultHandle,
  lastOrder,
  onClose,
  onUpdateQty,
  onOrderConfirmed,
  onClearReceipt,
  onGoToTracking,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState(defaultName);
  const [telegramHandle, setTelegramHandle] = useState(defaultHandle);
  const [deliveryOptionId, setDeliveryOptionId] = useState<DeliveryOption['id']>('courier_msk');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'concierge' | 'invoice'>('concierge');
  const [promoInput, setPromoInput] = useState(preselectedPromoCode);
  const [appliedPromo, setAppliedPromo] = useState(preselectedPromoCode);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (defaultName && !customerName) setCustomerName(defaultName);
    if (defaultHandle && !telegramHandle) setTelegramHandle(defaultHandle);
  }, [defaultName, defaultHandle, customerName, telegramHandle]);

  useEffect(() => {
    if (preselectedPromoCode) {
      setPromoInput(preselectedPromoCode);
      setAppliedPromo(preselectedPromoCode);
    }
  }, [preselectedPromoCode]);

  if (!isOpen) return null;

  const productById = new Map(products.map((p) => [p.id, p]));
  const subtotal = calculateCartSubtotal(cart, products);
  const promoEval = applyPromoCode(subtotal, appliedPromo, promoCodes);
  const selectedDelivery = getDeliveryOption(deliveryOptionId);
  const orderTotal = calculateOrderTotal(subtotal, deliveryOptionId, promoEval.discountRub);
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleApplyPromo = () => {
    setAppliedPromo(promoInput.trim());
  };

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validateCheckoutInput(
      {
        customerName,
        telegramHandle,
        deliveryOptionId,
        deliveryAddress,
        paymentMethod,
        promoCode: promoEval.valid ? promoEval.code : undefined,
      },
      totalCount
    );
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const items = cart
      .map((c) => {
        const product = productById.get(c.productId);
        return product ? { product, size: c.size, quantity: c.quantity } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const cleanHandle = normalizeTelegramHandle(telegramHandle);
    const resolvedAddress =
      deliveryOptionId === 'pickup' ? 'Шоурум SVV SHOP' : deliveryAddress.trim();

    setSubmitting(true);
    let createdId = `SVV-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          telegramHandle: cleanHandle,
          deliveryTitle: selectedDelivery.title,
          deliveryAddress: resolvedAddress,
          deliveryPrice: selectedDelivery.price,
          paymentMethod,
          promoCode: promoEval.valid ? promoEval.code : undefined,
          discountAmount: promoEval.discountRub,
          items: items.map((item) => ({
            productId: item.product.id,
            brand: item.product.brand,
            name: item.product.name,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.product.price,
          })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { order?: { id?: string } };
        if (data.order?.id) createdId = data.order.id;
      }
    } catch {
      // Keep deterministic local confirmation if offline
    } finally {
      setSubmitting(false);
    }

    const receipt: OrderReceipt = {
      id: createdId,
      createdAtLabel: 'Только что',
      customerName: customerName.trim(),
      telegramHandle: cleanHandle,
      deliveryTitle: selectedDelivery.title,
      deliveryPrice: selectedDelivery.price,
      deliveryAddress: resolvedAddress,
      paymentMethod,
      promoCode: promoEval.valid ? promoEval.code : undefined,
      discountAmount: promoEval.discountRub,
      items,
      subtotalAmount: subtotal,
      totalAmount: orderTotal,
    };

    setErrors([]);
    onOrderConfirmed(receipt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch bg-black/75 backdrop-blur-sm backdrop-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] sm:max-h-full bg-[var(--svv-surface)] text-[var(--svv-text)] rounded-t-3xl sm:rounded-none border-l border-[var(--svv-border)] flex flex-col shadow-2xl drawer-slide-responsive"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-[var(--svv-border-strong)] rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-4 border-b border-[var(--svv-border)] flex items-center justify-between">
          <div>
            <h2 id="cart-drawer-title" className="font-display text-lg font-bold text-[var(--svv-text)]">
              Корзина
            </h2>
            <p className="text-xs text-[var(--svv-muted)] tabular-nums">
              {lastOrder ? `Заказ ${lastOrder.id}` : `Позиций: ${totalCount}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть корзину"
            className="min-h-[40px] min-w-[40px] -mr-1 flex items-center justify-center rounded-full bg-[var(--svv-surface-2)] text-[var(--svv-text)] hover:opacity-80 transition-opacity cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {lastOrder ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[var(--svv-surface-2)] border border-[var(--svv-border)] space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[var(--svv-accent)] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-mono text-[var(--svv-muted)]">{lastOrder.id}</p>
                    <h3 className="text-base font-bold text-[var(--svv-text)]">Заказ оформлен</h3>
                    <p className="mt-1 text-xs text-[var(--svv-muted)]">
                      Менеджер свяжется в Telegram ({lastOrder.telegramHandle}).
                    </p>
                  </div>
                </div>

                <ul className="pt-3 border-t border-[var(--svv-border)] space-y-2 text-xs">
                  {lastOrder.items.map((item) => (
                    <li key={`${item.product.id}-${item.size}`} className="flex justify-between gap-3">
                      <span className="text-[var(--svv-text-soft)]">
                        {item.product.brand} · {item.product.name} ({item.size}) × {item.quantity}
                      </span>
                      <span className="font-semibold tabular-nums shrink-0 text-[var(--svv-text)]">
                        {formatRub(item.product.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                  {lastOrder.discountAmount > 0 && (
                    <li className="flex justify-between gap-3 text-[var(--svv-accent)]">
                      <span>Промокод ({lastOrder.promoCode})</span>
                      <span className="tabular-nums shrink-0">
                        −{formatRub(lastOrder.discountAmount)}
                      </span>
                    </li>
                  )}
                  <li className="flex justify-between gap-3 text-[var(--svv-muted)] pt-1">
                    <span>Доставка: {lastOrder.deliveryTitle}</span>
                    <span className="tabular-nums shrink-0">
                      {lastOrder.deliveryPrice === 0 ? 'Бесплатно' : formatRub(lastOrder.deliveryPrice)}
                    </span>
                  </li>
                </ul>

                <div className="pt-3 border-t border-[var(--svv-border)] flex justify-between text-sm font-bold text-[var(--svv-text)]">
                  <span>Итого</span>
                  <span className="tabular-nums text-[var(--svv-text)]">
                    {formatRub(lastOrder.totalAmount)}
                  </span>
                </div>
              </div>

              {(() => {
                const tgUrl = buildTelegramConciergeUrl(
                  MANAGER_TELEGRAM_HANDLE,
                  `Заказ ${lastOrder.id} (${lastOrder.deliveryTitle}) на сумму ${formatRub(lastOrder.totalAmount)}. Получатель: ${lastOrder.customerName}, адрес: ${lastOrder.deliveryAddress}`
                );
                return (
                  <a
                    href={tgUrl}
                    onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full min-h-[48px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-sm font-bold hover:bg-[var(--svv-accent-hover)] transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Отправить в Telegram</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                );
              })()}

              {onGoToTracking && (
                <button
                  type="button"
                  onClick={() => {
                    const code = lastOrder.id;
                    onClearReceipt();
                    onClose();
                    onGoToTracking(code);
                  }}
                  className="w-full min-h-[44px] px-4 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] text-xs font-bold text-[var(--svv-text)] hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Отследить в Личном кабинете
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClearReceipt();
                  onClose();
                }}
                className="w-full min-h-[44px] px-4 rounded-full border border-[var(--svv-border-strong)] text-xs font-semibold text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors cursor-pointer"
              >
                Продолжить покупки
              </button>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[var(--svv-surface-2)] mx-auto flex items-center justify-center text-[var(--svv-muted)]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <p className="text-base font-semibold text-[var(--svv-text)]">Корзина пуста</p>
              <p className="text-xs text-[var(--svv-muted)] max-w-xs mx-auto leading-relaxed">
                Добавьте позиции из каталога или соберите готовый фит дня на главной.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[var(--svv-border)]">
                {cart.map((item) => {
                  const product = productById.get(item.productId);
                  if (!product) return null;
                  return (
                    <li key={`${item.productId}-${item.size}`} className="py-3.5 first:pt-0 flex gap-3.5">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="w-16 h-20 rounded-xl object-cover bg-[var(--svv-well)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--svv-muted)]">
                          {product.brand}
                        </span>
                        <h3 className="text-sm font-medium text-[var(--svv-text)] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--svv-muted)]">Размер: {item.size}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center border border-[var(--svv-border)] rounded-full bg-[var(--svv-input)]">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.productId, item.size, -1)}
                              aria-label={`Уменьшить количество: ${product.name}`}
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[var(--svv-text)] cursor-pointer"
                            >
                              {item.quantity === 1 ? (
                                <Trash2 className="w-3.5 h-3.5 text-[var(--svv-muted)]" />
                              ) : (
                                <Minus className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="px-2 text-xs font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.productId, item.size, 1)}
                              aria-label={`Увеличить количество: ${product.name}`}
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center text-[var(--svv-text)] cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-[var(--svv-text)] tabular-nums">
                            {formatRub(product.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Promo Code Box */}
              <div className="pt-2 border-t border-[var(--svv-border)] space-y-2">
                <label htmlFor="promo-code" className="flex items-center gap-1.5 text-xs text-[var(--svv-muted)]">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Промокод (например, SVV10)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="promo-code"
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="SVV10"
                    className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-[var(--svv-input)] border border-[var(--svv-border)] text-xs text-[var(--svv-text)] uppercase placeholder:text-[var(--svv-muted)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="min-h-[40px] px-4 rounded-xl bg-[var(--svv-surface-2)] text-xs font-semibold text-[var(--svv-text)] hover:opacity-85 cursor-pointer"
                  >
                    Применить
                  </button>
                </div>
                {appliedPromo && (
                  <p className={`text-xs ${promoEval.valid ? 'text-[var(--svv-text)]' : 'text-[var(--svv-danger-fg)]'}`}>
                    {promoEval.label}
                  </p>
                )}
              </div>

              {/* Delivery selector */}
              <div className="space-y-2 pt-2 border-t border-[var(--svv-border)]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--svv-muted)]">
                  Выбор доставки
                </h3>
                <div className="space-y-2">
                  {DELIVERY_OPTIONS.map((option) => {
                    const active = deliveryOptionId === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDeliveryOptionId(option.id)}
                        aria-pressed={active}
                        className={`w-full p-3 rounded-xl border text-left cursor-pointer flex items-start justify-between gap-3 ${
                          active
                            ? 'border-[var(--svv-accent)] bg-[var(--svv-surface-2)]'
                            : 'border-[var(--svv-border)] bg-[var(--svv-input)] hover:border-[var(--svv-border-strong)]'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            aria-hidden="true"
                            className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              active
                                ? 'border-[var(--svv-accent)] bg-[var(--svv-accent)]'
                                : 'border-[var(--svv-border-strong)] bg-transparent'
                            }`}
                          >
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--svv-accent-fg)]" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--svv-text)]">{option.title}</p>
                            <p className="text-xs text-[var(--svv-muted)] mt-0.5">{option.eta}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[var(--svv-text)] tabular-nums shrink-0 mt-0.5">
                          {option.price === 0 ? 'Бесплатно' : formatRub(option.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--svv-surface-2)] border border-[var(--svv-border)] space-y-1.5 text-sm">
                <div className="flex justify-between text-[var(--svv-muted)]">
                  <span>Товары</span>
                  <span className="tabular-nums text-[var(--svv-text)]">{formatRub(subtotal)}</span>
                </div>
                {promoEval.discountRub > 0 && (
                  <div className="flex justify-between text-[var(--svv-text)]">
                    <span>Скидка ({promoEval.code})</span>
                    <span className="tabular-nums">−{formatRub(promoEval.discountRub)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--svv-muted)]">
                  <span>Доставка ({selectedDelivery.title})</span>
                  <span className="tabular-nums text-[var(--svv-text)]">
                    {selectedDelivery.price === 0 ? '0 ₽' : formatRub(selectedDelivery.price)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-[var(--svv-text)] pt-2 border-t border-[var(--svv-border)]">
                  <span>Итого</span>
                  <span className="tabular-nums text-[var(--svv-text)]">{formatRub(orderTotal)}</span>
                </div>
              </div>

              <form id="checkout-form" onSubmit={handleCheckoutSubmit} noValidate className="space-y-3">
                <div>
                  <label htmlFor="checkout-name" className="block text-xs text-[var(--svv-muted)] mb-1">
                    Имя получателя
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Имя и фамилия"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--svv-border)] bg-[var(--svv-input)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="checkout-tg" className="block text-xs text-[var(--svv-muted)] mb-1">
                    Telegram @username
                  </label>
                  <input
                    id="checkout-tg"
                    type="text"
                    value={telegramHandle}
                    onChange={(e) => setTelegramHandle(e.target.value)}
                    placeholder="@username"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--svv-border)] bg-[var(--svv-input)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-accent)]"
                  />
                </div>

                {deliveryOptionId !== 'pickup' && (
                  <div>
                    <label htmlFor="checkout-address" className="block text-xs text-[var(--svv-muted)] mb-1">
                      Город и адрес доставки
                    </label>
                    <input
                      id="checkout-address"
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Город, улица, дом"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--svv-border)] bg-[var(--svv-input)] text-sm text-[var(--svv-text)] focus:outline-none focus:border-[var(--svv-accent)]"
                    />
                  </div>
                )}

                <div>
                  <span className="block text-xs text-[var(--svv-muted)] mb-1.5">Оплата</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('concierge')}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        paymentMethod === 'concierge'
                          ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                          : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                      }`}
                    >
                      После примерки
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('invoice')}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                        paymentMethod === 'invoice'
                          ? 'bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] border-[var(--svv-accent)]'
                          : 'bg-[var(--svv-input)] text-[var(--svv-text)] border-[var(--svv-border)]'
                      }`}
                    >
                      Счёт / Карта
                    </button>
                  </div>
                </div>

                {errors.length > 0 && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-[var(--svv-danger-bg)] border border-[var(--svv-danger-border)] text-xs text-[var(--svv-danger-fg)] space-y-1"
                  >
                    {errors.map((err) => (
                      <p key={err}>{err}</p>
                    ))}
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {!lastOrder && cart.length > 0 && (
          <div className="p-5 border-t border-[var(--svv-border)] bg-[var(--svv-surface)]">
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full min-h-[48px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-sm font-bold hover:bg-[var(--svv-accent-hover)] transition-colors cursor-pointer disabled:opacity-70"
            >
              {submitting ? 'Отправка заказа...' : `Оформить заказ · ${formatRub(orderTotal)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
