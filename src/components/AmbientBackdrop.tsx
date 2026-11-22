export function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Slowly drifting architectural grid visible across the entire canvas */}
      <div
        className="absolute -inset-16 ambient-grid-drift"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--svv-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--svv-grid) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 92% 88% at 50% 35%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 92% 88% at 50% 35%, #000 40%, transparent 100%)',
        }}
      />

      {/* Shared site-wide drifting ambient spotlight orbs */}
      <div
        className="absolute -top-36 -left-24 w-[440px] h-[440px] sm:w-[640px] sm:h-[640px] rounded-full ambient-orb-one"
        style={{
          background:
            'radial-gradient(circle, var(--svv-orb-1) 0%, var(--svv-orb-3) 45%, transparent 72%)',
        }}
      />

      <div
        className="absolute top-[34%] -right-28 w-[400px] h-[400px] sm:w-[580px] sm:h-[580px] rounded-full ambient-orb-two"
        style={{
          background:
            'radial-gradient(circle, var(--svv-orb-2) 0%, var(--svv-orb-3) 48%, transparent 72%)',
        }}
      />

      <div
        className="absolute -bottom-36 left-[22%] w-[380px] h-[380px] sm:w-[540px] sm:h-[540px] rounded-full ambient-orb-three"
        style={{
          background:
            'radial-gradient(circle, var(--svv-orb-1) 0%, transparent 70%)',
        }}
      />

      {/* Sweeping diagonal light beam across the full background */}
      <div
        className="absolute top-0 left-0 w-44 sm:w-56 h-[150%] ambient-beam-sweep"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--svv-beam) 50%, transparent 100%)',
        }}
      />

      {/* Subtle orbiting geometric halo rings in wide desktop margins */}
      <svg
        viewBox="0 0 220 220"
        className="hidden lg:block absolute top-[22%] right-[3%] w-44 h-44 banner-seal-spin"
        style={{ color: 'var(--svv-ring)' }}
      >
        <circle
          cx="110"
          cy="110"
          r="98"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="6 10"
        />
      </svg>

      {/* Floating minimalist cross accents synced to active theme */}
      <span
        className="absolute top-[16%] left-[5%] font-display italic text-4xl sm:text-5xl font-black ambient-cross-drift"
        style={{ color: 'var(--svv-cross)' }}
      >
        †
      </span>
      <span
        className="hidden sm:block absolute top-[56%] right-[8%] font-display italic text-6xl font-black ambient-cross-drift"
        style={{ color: 'var(--svv-cross)', animationDelay: '-5s' }}
      >
        †
      </span>
      <span
        className="absolute bottom-[18%] left-[14%] font-display italic text-3xl sm:text-4xl font-black ambient-cross-drift"
        style={{ color: 'var(--svv-cross)', animationDelay: '-9s' }}
      >
        †
      </span>
    </div>
  );
}
