import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, RotateCw, Sparkles, Tag } from 'lucide-react';
import { MANAGER_TELEGRAM_HANDLE, type PrizeWheelConfig, type PrizeWheelSegment } from '../data/catalog';
import {
  calculateWheelTargetAngle,
  getWheelSignature,
  pickWeightedSegmentIndex,
} from '../utils/shopLogic';
import { buildTelegramConciergeUrl, handleTelegramLinkClick } from '../utils/telegram';
import { PrizeWheelGraphic } from './PrizeWheelGraphic';

interface PrizeWheelSectionProps {
  config: PrizeWheelConfig;
  onApplyWonPromo: (code: string) => void;
}

const STORAGE_WHEEL_WIN_KEY = 'svv_wheel_win_v1';

interface StoredWheelWin {
  signature: string;
  segment: PrizeWheelSegment;
}

export function PrizeWheelSection({ config, onApplyWonPromo }: PrizeWheelSectionProps) {
  const wheelSignature = getWheelSignature(config);

  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wonSegment, setWonSegment] = useState<PrizeWheelSegment | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WHEEL_WIN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredWheelWin;
      if (parsed.signature === wheelSignature && parsed.segment) {
        return parsed.segment;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WHEEL_WIN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredWheelWin;
      if (parsed.signature !== wheelSignature) {
        setWonSegment(null);
      }
    } catch {
      // Ignore storage errors
    }
  }, [wheelSignature]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!config.enabled || config.segments.length < 2) {
    return null;
  }

  const handleSpin = () => {
    if (isSpinning || wonSegment) return;
    const winnerIndex = pickWeightedSegmentIndex(config.segments, Math.random());
    const winner = config.segments[winnerIndex];
    const nextRotation = calculateWheelTargetAngle(
      rotation,
      winnerIndex,
      config.segments.length,
      5
    );

    setIsSpinning(true);
    setRotation(nextRotation);

    timerRef.current = window.setTimeout(() => {
      setIsSpinning(false);
      setWonSegment(winner);
      try {
        localStorage.setItem(
          STORAGE_WHEEL_WIN_KEY,
          JSON.stringify({ signature: wheelSignature, segment: winner } satisfies StoredWheelWin)
        );
      } catch {
        // Ignore storage errors
      }
    }, 4350);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  return (
    <section
      id="prize-wheel-section"
      aria-label="Колесо призов SVV"
      className="px-4 sm:px-0 mt-7"
    >
      <div className="relative overflow-hidden p-5 sm:p-8 rounded-2xl bg-[var(--svv-surface)]/88 backdrop-blur-md border border-[var(--svv-border)]">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none opacity-40"
          style={{
            background: 'radial-gradient(circle, var(--svv-orb-1) 0%, transparent 70%)',
          }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
          {/* Left: Interactive SVG Wheel */}
          <div className="flex flex-col items-center">
            <PrizeWheelGraphic
              segments={config.segments}
              rotation={rotation}
              isSpinning={isSpinning}
              onCenterClick={handleSpin}
              centerLabel={isSpinning ? '...' : wonSegment ? 'WIN' : 'SPIN'}
            />
          </div>

          {/* Right: Info, Prize List & Result */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--svv-muted)]">
                SVV † FORTUNE WHEEL
              </p>
              <h2 className="mt-1 font-display text-xl sm:text-2xl font-black uppercase text-[var(--svv-text)] tracking-tight headline-balance">
                {config.title}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[var(--svv-muted)] leading-relaxed">
                {config.subtitle}
              </p>
            </div>

            {wonSegment ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-[var(--svv-input)] border border-[var(--svv-accent)]/50 space-y-3 modal-pop-responsive">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-[var(--svv-accent)] shrink-0 mt-0.5 spark-float" />
                  <div>
                    <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--svv-muted)]">
                      Ваш приз получен
                    </p>
                    <h3 className="text-base sm:text-lg font-bold text-[var(--svv-text)]">
                      {wonSegment.label}
                    </h3>
                    {wonSegment.description && (
                      <p className="mt-1 text-xs text-[var(--svv-text-soft)] leading-relaxed">
                        {wonSegment.description}
                      </p>
                    )}
                  </div>
                </div>

                {wonSegment.promoCode ? (
                  <div className="pt-2 border-t border-[var(--svv-border)] space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--svv-surface)] border border-[var(--svv-border)]">
                      <span className="inline-flex items-center gap-2 text-xs text-[var(--svv-muted)]">
                        <Tag className="w-3.5 h-3.5 text-[var(--svv-accent)]" />
                        <span>Промокод:</span>
                        <strong className="font-mono text-sm text-[var(--svv-text)] tracking-wider">
                          {wonSegment.promoCode}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(wonSegment.promoCode)}
                        aria-label="Скопировать промокод"
                        className="min-h-[34px] px-2.5 rounded-lg bg-[var(--svv-surface-2)] hover:opacity-85 text-[var(--svv-text)] text-xs inline-flex items-center gap-1 cursor-pointer press-spring"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Скопировано' : 'Копия'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onApplyWonPromo(wonSegment.promoCode)}
                      className="w-full min-h-[44px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring cursor-pointer"
                    >
                      Применить {wonSegment.promoCode} в корзине
                    </button>
                  </div>
                ) : (
                  (() => {
                    const tgUrl = buildTelegramConciergeUrl(
                      MANAGER_TELEGRAM_HANDLE,
                      `Привет! Выиграл в колесе SVV SHOP приз: «${wonSegment.label}».`
                    );
                    return (
                      <a
                        href={tgUrl}
                        onClick={(e) => handleTelegramLinkClick(e, tgUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full min-h-[44px] px-4 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center justify-center gap-2"
                      >
                        <span>Забрать у {MANAGER_TELEGRAM_HANDLE}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    );
                  })()
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--svv-border)] border-y border-[var(--svv-border)]">
                  {config.segments.slice(0, 6).map((seg) => (
                    <div
                      key={seg.id}
                      className="py-2 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="text-[var(--svv-text-soft)] font-medium truncate">
                        {seg.label}
                      </span>
                      <span className="font-mono text-[var(--svv-muted)] shrink-0">
                        {seg.promoCode || seg.shortLabel}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSpin}
                  disabled={isSpinning}
                  className="w-full sm:w-auto min-h-[46px] px-6 rounded-full bg-[var(--svv-accent)] text-[var(--svv-accent-fg)] text-xs font-bold hover:bg-[var(--svv-accent-hover)] press-spring inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
                  <span>{isSpinning ? 'Колесо крутится...' : 'Крутить колесо'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
