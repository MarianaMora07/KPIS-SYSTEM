"use client";

/**
 * Ondas fluidas estilo Siri detrás del hero — paleta Estelar #0B3061
 */
export function SiriWavesBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {/* Glow central */}
      <div className="absolute left-1/2 top-1/2 h-[480px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#0B3061]/12 blur-[100px]" />

      <svg
        className="absolute bottom-0 left-0 h-[55%] w-[200%] min-w-[1440px] opacity-90"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="siri-wave-1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B3061" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#0E3D7A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0B3061" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="siri-wave-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#092952" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#0B3061" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0E3D7A" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="siri-wave-3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B3061" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#1a5a9e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0B3061" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <g className="siri-wave-layer siri-wave-layer-1">
          <path
            fill="url(#siri-wave-1)"
            d="M0,220 C240,180 480,260 720,220 C960,180 1200,260 1440,220 L1440,400 L0,400 Z"
          />
          <path
            fill="url(#siri-wave-1)"
            d="M0,220 C240,180 480,260 720,220 C960,180 1200,260 1440,220 L1440,400 L0,400 Z"
            transform="translate(1440, 0)"
          />
        </g>

        <g className="siri-wave-layer siri-wave-layer-2">
          <path
            fill="url(#siri-wave-2)"
            d="M0,260 C200,300 400,220 600,260 C800,300 1000,220 1200,260 C1320,290 1380,250 1440,270 L1440,400 L0,400 Z"
          />
          <path
            fill="url(#siri-wave-2)"
            d="M0,260 C200,300 400,220 600,260 C800,300 1000,220 1200,260 C1320,290 1380,250 1440,270 L1440,400 L0,400 Z"
            transform="translate(1440, 0)"
          />
        </g>

        <g className="siri-wave-layer siri-wave-layer-3">
          <path
            fill="url(#siri-wave-3)"
            d="M0,300 C180,270 360,330 540,300 C720,270 900,330 1080,300 C1260,270 1380,320 1440,305 L1440,400 L0,400 Z"
          />
          <path
            fill="url(#siri-wave-3)"
            d="M0,300 C180,270 360,330 540,300 C720,270 900,330 1080,300 C1260,270 1380,320 1440,305 L1440,400 L0,400 Z"
            transform="translate(1440, 0)"
          />
        </g>
      </svg>

      {/* Ribbons superiores — efecto Siri en la parte alta del hero */}
      <svg
        className="siri-ribbon siri-ribbon-1 absolute left-[-10%] top-[18%] h-32 w-[120%] opacity-60"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="siri-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B3061" stopOpacity="0" />
            <stop offset="30%" stopColor="#0B3061" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#0E3D7A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0B3061" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="none"
          stroke="url(#siri-ribbon-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          d="M0,60 Q100,20 200,60 T400,60 T600,60 T800,60"
        />
      </svg>

      <svg
        className="siri-ribbon siri-ribbon-2 absolute left-[-5%] top-[28%] h-28 w-[110%] opacity-50"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="siri-ribbon-grad-2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B3061" stopOpacity="0" />
            <stop offset="30%" stopColor="#0B3061" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#0E3D7A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0B3061" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="none"
          stroke="url(#siri-ribbon-grad-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          d="M0,70 Q120,30 240,70 T480,70 T720,70 T800,70"
        />
      </svg>

      <svg
        className="siri-ribbon siri-ribbon-3 absolute left-[-8%] top-[38%] h-24 w-[115%] opacity-40"
        viewBox="0 0 800 120"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="siri-ribbon-grad-3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0B3061" stopOpacity="0" />
            <stop offset="30%" stopColor="#0B3061" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#0E3D7A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0B3061" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          fill="none"
          stroke="url(#siri-ribbon-grad-3)"
          strokeWidth="2"
          strokeLinecap="round"
          d="M0,50 Q80,90 160,50 T320,50 T480,50 T640,50 T800,50"
        />
      </svg>

      {/* Fade inferior para transición suave a la siguiente sección */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent" />
    </div>
  );
}
