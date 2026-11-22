import type { CSSProperties } from 'react';
import type { PrizeWheelSegment, WheelAccent } from '../data/catalog';

interface PrizeWheelGraphicProps {
  segments: PrizeWheelSegment[];
  rotation?: number;
  isSpinning?: boolean;
  size?: 'md' | 'sm';
  onCenterClick?: () => void;
  centerLabel?: string;
}

const ACCENT_PALETTE: Record<WheelAccent, { fill: string; text: string }> = {
  obsidian: { fill: '#111114', text: '#eae7df' },
  bone: { fill: '#eae7df', text: '#111111' },
  smoke: { fill: '#222227', text: '#ffffff' },
  crimson: { fill: '#4c1118', text: '#f4f0e8' },
};

function polarToCartesian(cx: number, cy: number, r: number, degFromTop: number) {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function buildWedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

export function PrizeWheelGraphic({
  segments,
  rotation = 0,
  isSpinning = false,
  size = 'md',
  onCenterClick,
  centerLabel = 'SPIN',
}: PrizeWheelGraphicProps) {
  const safeSegments = segments.length >= 2 ? segments : [];
  const total = safeSegments.length;
  const sliceAngle = total > 0 ? 360 / total : 360;

  const wheelStyle: CSSProperties = {
    transform: `rotate(${rotation}deg)`,
    transition: isSpinning ? 'transform 4300ms cubic-bezier(0.12, 0.85, 0.16, 1)' : 'none',
  };

  const containerSizeClass =
    size === 'sm' ? 'w-48 h-48 sm:w-52 sm:h-52' : 'w-[272px] h-[272px] sm:w-[320px] sm:h-[320px]';

  return (
    <div className={`relative mx-auto select-none ${containerSizeClass}`}>
      {/* Top 12-o'clock pointer */}
      <div
        aria-hidden="true"
        className={`absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 drop-shadow-md ${
          isSpinning ? 'pointer-tick-spin' : ''
        }`}
      >
        <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
          <path d="M13 26L2 4H24L13 26Z" fill="#eae7df" stroke="#070709" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Rotating Wheel SVG */}
      <div className="w-full h-full will-change-transform" style={wheelStyle}>
        <svg viewBox="0 0 320 320" className="w-full h-full drop-shadow-2xl">
          {/* Outer Metallic Rim */}
          <circle cx="160" cy="160" r="154" fill="#18181b" stroke="#3f3f46" strokeWidth="3" />
          <circle cx="160" cy="160" r="142" fill="#070709" stroke="rgba(234,231,223,0.3)" strokeWidth="1.5" />

          {/* Rim Studs */}
          {Array.from({ length: Math.max(8, total * 2) }).map((_, idx, arr) => {
            const deg = (360 / arr.length) * idx;
            const pt = polarToCartesian(160, 160, 148, deg);
            return (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r="2.2"
                fill={idx % 2 === 0 ? '#eae7df' : '#71717a'}
              />
            );
          })}

          {/* Wedges */}
          {safeSegments.map((seg, i) => {
            const startDeg = i * sliceAngle;
            const endDeg = (i + 1) * sliceAngle;
            const midDeg = (i + 0.5) * sliceAngle;
            const palette = ACCENT_PALETTE[seg.accent] ?? ACCENT_PALETTE.obsidian;
            const fontSize = total >= 8 ? 10 : total >= 6 ? 11.5 : 13;

            const isLeftHalf = midDeg > 180 && midDeg < 360;
            const textTransform = isLeftHalf
              ? `rotate(${midDeg - 90}, 160, 160) rotate(180, 244, 160)`
              : `rotate(${midDeg - 90}, 160, 160)`;

            return (
              <g key={seg.id}>
                <path
                  d={buildWedgePath(160, 160, 140, startDeg, endDeg)}
                  fill={palette.fill}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1.2"
                />
                <text
                  x="244"
                  y="160"
                  fill={palette.text}
                  fontSize={fontSize}
                  fontWeight="800"
                  letterSpacing="0.03em"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={textTransform}
                >
                  {seg.shortLabel.slice(0, 14)}
                </text>
              </g>
            );
          })}

          {/* Inner Ring */}
          <circle cx="160" cy="160" r="36" fill="#070709" stroke="#eae7df" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Center Hub Button */}
      {onCenterClick ? (
        <button
          type="button"
          onClick={onCenterClick}
          disabled={isSpinning}
          aria-label="Крутить колесо призов"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-16 h-16 rounded-full bg-[#111113] border-2 border-[#eae7df] text-[#eae7df] flex flex-col items-center justify-center shadow-lg hover:bg-[#1c1c20] press-spring cursor-pointer disabled:opacity-80"
        >
          <span className="text-[10px] font-display italic font-black tracking-tight leading-none">
            SVV †
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest mt-0.5 leading-none">
            {centerLabel}
          </span>
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-[#111113] border border-[#eae7df] text-[#eae7df] flex items-center justify-center text-[9px] font-display italic font-black"
        >
          SVV †
        </div>
      )}
    </div>
  );
}
