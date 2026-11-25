import { useState, type CSSProperties } from 'react';
import { ArrowRight, Globe, MessageSquare, Plus, ShoppingBag, Shuffle } from 'lucide-react';
import {
  CATEGORY_TILES,
  MANAGER_TELEGRAM_HANDLE,
  type HeroBannerConfig,
  type LuxuryProduct,
  type PrizeWheelConfig,
  type ProductCategory,
} from '../data/catalog';
import { formatRub, generateRandomFit } from '../utils/shopLogic';
import { PrizeWheelSection } from './PrizeWheelSection';
import { ProductCard } from './ProductCard';

interface HomeFeedViewProps {
  products: LuxuryProduct[];
  prizeWheel: PrizeWheelConfig;
  heroBanner: HeroBannerConfig;
  onOpenDetail: (product: LuxuryProduct) => void;
  onQuickAdd: (product: LuxuryProduct) => void;
  onSelectCategory: (category: ProductCategory) => void;
  onGoToCatalog: () => void;
  onGoToChinaBuyout: () => void;
  onGoToManager: () => void;
  onGoToAdmin: () => void;
  onAddFitToCart: (items: LuxuryProduct[]) => void;
  onApplyWonPromo: (code: string) => void;
}

export function HomeFeedView({
  products,
  prizeWheel,
  heroBanner,
  onOpenDetail,
  onQuickAdd,
  onSelectCategory,
  onGoToCatalog,
  onGoToChinaBuyout,
  onGoToManager,
  onGoToAdmin,
  onAddFitToCart,
  onApplyWonPromo,
}: HomeFeedViewProps) {
  const [fitSeed, setFitSeed] = useState(0);

  const newArrivals = products.slice(0, 8);
  const randomFit = generateRandomFit(products, fitSeed);
  const randomFitTotal = randomFit.reduce((sum, item) => sum + item.price, 0);

  const addedBrands = Array.from(
    new Set(products.map((p) => p.brand.trim()).filter(Boolean))
  );

  const defaultHeroDescription =
    addedBrands.length > 0
      ? `В витрине: ${addedBrands.slice(0, 6).join(', ')} — живые фото от менеджера и доставка по вашему адресу.`
      : 'Вещи в наличии, прямой выкуп из Китая, живые фото от менеджера и доставка по вашему адресу.';

  const heroDescription = heroBanner.description.trim() || defaultHeroDescription;

  const defaultTickerText =
    addedBrands.length > 0
      ? `SVV † SHOP † ${addedBrands
          .slice(0, 8)
          .map((b) => b.toUpperCase())
          .join(' † ')} † ВЫКУП ИЗ КИТАЯ † ДОСТАВКА ПО РФ`
      : 'SVV † SHOP † ЗАКРЫТАЯ ВИТРИНА † ВЫКУП ИЗ КИТАЯ † ЖИВЫЕ ФОТО ОТ МЕНЕДЖЕРА † ДОСТАВКА ПО РФ И МИРУ';

  const tickerText = heroBanner.tickerOverride.trim() || defaultTickerText;

  return (
    <div className="pb-6">
      {/* 1. Editable Animated SVV SHOP Store Banner */}
      <section className="relative overflow-hidden sm:rounded-2xl sm:mt-4 bg-[var(--svv-surface)]/88 backdrop-blur-md border-b sm:border border-[var(--svv-border)] shadow-2xl">
        {heroBanner.imageUrl && (
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            <img
              src={heroBanner.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--svv-surface)]/95 via-[var(--svv-surface)]/82 to-[var(--svv-surface)]/72" />
          </div>
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none hero-ambient-drift"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 25%, var(--svv-orb-1), transparent 48%), radial-gradient(circle at 18% 85%, var(--svv-orb-2), transparent 46%)',
          }}
        />

        <div className="relative p-5 sm:p-8 lg:p-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-xl space-y-3.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--svv-muted)]">
              {heroBanner.eyebrow}
            </p>

            <div>
              <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none banner-chrome-text">
                {heroBanner.title}
              </h1>
              <p className="mt-2 font-display text-base sm:text-xl font-bold text-[var(--svv-text)] headline-balance">
                {heroBanner.subtitle}
              </p>
              <p className="mt-1.5 text-xs sm:text-sm text-[var(--svv-muted)] leading-relaxed">
                {heroDescription}
              </p>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onGoToCatalog}
                className="min-h-[44px] px-5 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{heroBanner.primaryCtaLabel}</span>
              </button>
              <button
                type="button"
                onClick={onGoToChinaBuyout}
                className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] text-[var(--svv-text)] text-xs font-semibold hover:opacity-90 press-spring inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{heroBanner.secondaryCtaLabel}</span>
              </button>
            </div>
          </div>

          {/* Animated Orbital Store Seal & Neutral Delivery Highlights */}
          <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-6 shrink-0">
            <div className="flex flex-col gap-2">
              <div className="px-3.5 py-2 rounded-xl bg-[var(--svv-surface-2)]/90 border border-[var(--svv-border)] backdrop-blur-sm banner-float-card">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--svv-muted)]">
                  В витрине
                </p>
                <p className="text-xs font-bold text-[var(--svv-text)] tabular-nums">
                  {products.length > 0 ? `${products.length} поз.` : 'Скоро дроп'}
                </p>
              </div>
              <div
                className="px-3.5 py-2 rounded-xl bg-[var(--svv-surface-2)]/90 border border-[var(--svv-border)] backdrop-blur-sm banner-float-card"
                style={{ animationDelay: '-2.7s' }}
              >
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--svv-muted)]">
                  {heroBanner.promoMetricLabel}
                </p>
                <p className="text-xs font-bold text-[var(--svv-text)]">
                  {heroBanner.promoMetricValue}
                </p>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="relative w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center shrink-0"
            >
              <svg
                viewBox="0 0 140 140"
                className="w-full h-full banner-seal-spin text-[var(--svv-muted)] opacity-55"
              >
                <circle
                  cx="70"
                  cy="70"
                  r="64"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeDasharray="6 6"
                />
              </svg>
              <svg
                viewBox="0 0 140 140"
                className="absolute inset-0 w-full h-full banner-seal-spin-reverse text-[var(--svv-text)] opacity-25"
              >
                <circle
                  cx="70"
                  cy="70"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="18 8"
                />
              </svg>
              <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border-strong)] flex flex-col items-center justify-center shadow-lg px-2 text-center">
                <span className="font-display italic text-sm sm:text-base font-black text-[var(--svv-text)] leading-none truncate max-w-full">
                  {heroBanner.sealTop}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--svv-muted)] mt-1 truncate max-w-full">
                  {heroBanner.sealBottom}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clean Continuous Ticker (shows admin-added brands or custom banner text) */}
        <div
          aria-hidden="true"
          className="relative border-t border-[var(--svv-border)] bg-[var(--svv-bg-soft)]/70 py-2 overflow-hidden"
        >
          <div className="banner-marquee-track text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
            <span className="px-4 whitespace-nowrap">{tickerText}</span>
            <span className="px-4 whitespace-nowrap">{tickerText}</span>
          </div>
        </div>
      </section>

      {/* 2. 4 Category Tiles */}
      <section aria-label="Категории" className="px-4 sm:px-0 mt-3.5 sm:mt-5">
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {CATEGORY_TILES.map((tile, idx) => {
            const categoryItems = products.filter((p) => p.category === tile.category);
            const realPreview = categoryItems[0]?.imageUrl;
            return (
              <button
                key={tile.category}
                type="button"
                onClick={() => onSelectCategory(tile.category)}
                style={{ '--stagger': idx } as CSSProperties}
                className="stagger-item press-spring group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-[var(--svv-surface)]/90 backdrop-blur-sm border border-[var(--svv-border)] hover:border-[var(--svv-border-strong)] hover:-translate-y-0.5 transition-all text-left cursor-pointer"
              >
                {realPreview ? (
                  <>
                    <img
                      src={realPreview}
                      alt={tile.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 contrast-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 p-2 sm:p-3.5 flex items-start justify-between gap-1 bg-gradient-to-br from-[var(--svv-surface-2)] to-[var(--svv-surface)]">
                    <span className="text-[8px] sm:text-[10px] font-mono tracking-widest text-[var(--svv-muted)] truncate">
                      {tile.tag}
                    </span>
                    <span className="text-[var(--svv-muted)] opacity-35 font-display italic text-sm sm:text-xl font-black leading-none">
                      †
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-1.5 bottom-1.5 sm:inset-x-3 sm:bottom-2.5 flex items-baseline justify-between gap-1">
                  <span
                    className={`text-[11px] sm:text-sm font-bold truncate ${
                      realPreview ? 'text-[#ffffff]' : 'text-[var(--svv-text)]'
                    }`}
                  >
                    {tile.label}
                  </span>
                  {categoryItems.length > 0 && (
                    <span
                      className={`hidden sm:inline text-[11px] font-mono tabular-nums ${
                        realPreview ? 'text-[#e4e4e7]' : 'text-[var(--svv-muted)]'
                      }`}
                    >
                      {categoryItems.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Новые поступления */}
      <section className="mt-6 sm:mt-8">
        <div className="px-4 sm:px-0 flex items-center justify-between gap-4 mb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[var(--svv-accent)] text-sm" aria-hidden="true">
              †
            </span>
            <h2 className="font-display text-lg sm:text-xl font-black uppercase tracking-tight text-[var(--svv-text)]">
              Новые поступления
            </h2>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            aria-label="Перейти ко всему каталогу"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--svv-text)] hover:bg-[var(--svv-surface-2)] transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {newArrivals.length === 0 ? (
          <div className="px-4 sm:px-0">
            <div className="p-6 sm:p-8 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                  ВИТРИНА ЖДЁТ ПЕРВЫЙ ДРОП
                </p>
                <h3 className="font-display text-base sm:text-lg font-bold text-[var(--svv-text)]">
                  Добавьте первые позиции в каталог
                </h3>
                <p className="text-xs sm:text-sm text-[var(--svv-muted)] max-w-xl">
                  Загрузите реальные фотографии, укажите бренды, цены и описания вещей в
                  Админ-панели — они сразу появятся здесь и в каталоге.
                </p>
              </div>
              <button
                type="button"
                onClick={onGoToAdmin}
                className="min-h-[44px] px-5 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить вещи</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex md:grid md:grid-cols-4 gap-3 sm:gap-5 overflow-x-auto md:overflow-visible no-scrollbar px-4 sm:px-0 snap-x snap-mandatory">
            {newArrivals.map((product, idx) => (
              <div
                key={product.id}
                style={{ '--stagger': idx } as CSSProperties}
                className="stagger-item w-[43%] min-w-[154px] sm:w-[220px] md:w-auto shrink-0 snap-start"
              >
                <ProductCard
                  product={product}
                  onOpenDetail={onOpenDetail}
                  onQuickAdd={onQuickAdd}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3.5 Interactive Prize Wheel */}
      <PrizeWheelSection config={prizeWheel} onApplyWonPromo={onApplyWonPromo} />

      {/* 4. Random Fit + Manager Direct Contact */}
      <section className="px-4 sm:px-0 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {randomFit.length >= 2 && (
          <div className="lg:col-span-2 p-5 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                  FIT GENERATOR · SVV
                </p>
                <h2 className="font-display text-lg sm:text-xl font-black uppercase text-[var(--svv-text)]">
                  Собери случайный фит дня
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFitSeed((s) => s + 1)}
                className="min-h-[40px] px-3.5 py-2 rounded-full bg-[var(--svv-surface-2)] border border-[var(--svv-border)] text-[var(--svv-text)] text-xs font-semibold hover:opacity-90 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Пересобрать</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
              {randomFit.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenDetail(item)}
                  className="text-left group cursor-pointer"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[var(--svv-well)] border border-[var(--svv-border)]">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--svv-muted)] truncate">
                    {item.brand}
                  </p>
                  <p className="text-xs font-medium text-[var(--svv-text)] tabular-nums">
                    {formatRub(item.price)}
                  </p>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-[var(--svv-border)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="block text-[11px] text-[var(--svv-muted)]">Весь комплект</span>
                <span className="text-base font-bold text-[var(--svv-text)] tabular-nums">
                  {formatRub(randomFitTotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAddFitToCart(randomFit)}
                className="min-h-[42px] px-4 py-2 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Добавить фит</span>
              </button>
            </div>
          </div>
        )}

        <div
          className={`p-5 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)] flex flex-col justify-between gap-4 ${
            randomFit.length < 2 ? 'lg:col-span-3 sm:flex-row sm:items-center' : ''
          }`}
        >
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
              <MessageSquare className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
              Менеджер {MANAGER_TELEGRAM_HANDLE} 24/7
            </span>
            <h2 className="font-display text-lg font-black uppercase text-[var(--svv-text)]">
              Связь с менеджером и выкуп
            </h2>
            <p className="text-xs sm:text-sm text-[var(--svv-muted)] leading-relaxed max-w-xl">
              Скинем живые фото и замеры нужной вещи, поможем с выкупом из Китая и оформим
              доставку в ваш город.
            </p>
            <p className="text-xs text-[var(--svv-text)] font-mono pt-1">
              Код клуба: SVV10 (−10% в корзине)
            </p>
          </div>

          <div
            className={`flex flex-col gap-2 ${
              randomFit.length < 2 ? 'sm:w-64 shrink-0' : ''
            }`}
          >
            <button
              type="button"
              onClick={onGoToManager}
              className="w-full min-h-[44px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
            >
              Связаться с менеджером
            </button>
            <button
              type="button"
              onClick={onGoToChinaBuyout}
              className="w-full min-h-[44px] px-4 rounded-full border border-[var(--svv-border-strong)] text-[var(--svv-text)] text-xs font-semibold hover:bg-[var(--svv-surface-2)] press-spring cursor-pointer"
            >
              Калькулятор выкупа из Китая
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
