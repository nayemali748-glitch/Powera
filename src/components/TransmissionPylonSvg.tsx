import React from 'react';

interface TransmissionPylonSvgProps {
  theme: 'day' | 'night';
  mode?: 'banner' | 'card';
  className?: string;
}

export const TransmissionPylonSvg: React.FC<TransmissionPylonSvgProps> = ({
  theme,
  mode = 'card',
  className = ''
}) => {
  const isNight = theme === 'night';

  if (mode === 'banner') {
    return (
      <svg
        viewBox="0 0 320 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* Day Mode Warm Sunburst & Sunlight Glow */}
          <radialGradient id="pylonDaySunburst" cx="72%" cy="55%" r="45%" fx="72%" fy="55%">
            <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>

          {/* Night Mode Electric Cyan Ambient Glow */}
          <radialGradient id="pylonNightAura" cx="75%" cy="50%" r="50%" fx="75%" fy="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#0284c7" stopOpacity="0.3" />
            <stop offset="80%" stopColor="#0a1945" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#030712" stopOpacity="0" />
          </radialGradient>

          <filter id="pylonElectricNeonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Glow / Sunburst behind transmission tower */}
        <rect
          x="100"
          y="0"
          width="220"
          height="200"
          fill={isNight ? 'url(#pylonNightAura)' : 'url(#pylonDaySunburst)'}
        />

        {/* DISTANT SECONDARY PYLON (Adds depth as shown in photos) */}
        <g
          stroke={isNight ? '#0369a1' : '#0f172a'}
          strokeWidth={1}
          opacity={isNight ? 0.45 : 0.4}
        >
          <line x1="150" y1="90" x2="135" y2="185" strokeWidth="1.2" />
          <line x1="158" y1="90" x2="173" y2="185" strokeWidth="1.2" />
          <line x1="140" y1="110" x2="168" y2="110" strokeWidth="1.5" />
          <line x1="134" y1="130" x2="174" y2="130" strokeWidth="1.5" />
          <line x1="145" y1="95" x2="162" y2="120" />
          <line x1="162" y1="95" x2="145" y2="120" />
        </g>

        {/* MAIN FOREGROUND PYLON LATTICE TOWER */}
        <g
          stroke={isNight ? '#0f172a' : '#0f172a'}
          strokeWidth={isNight ? 2 : 2.2}
          opacity={isNight ? 0.95 : 0.95}
        >
          {/* Main Tapered Legs */}
          <line x1="230" y1="20" x2="188" y2="200" strokeWidth={isNight ? 2.5 : 2.8} />
          <line x1="254" y1="20" x2="296" y2="200" strokeWidth={isNight ? 2.5 : 2.8} />

          {/* Peak Cap */}
          <polygon
            points="228,20 256,20 242,4"
            fill={isNight ? '#0284c7' : '#0f172a'}
            opacity={0.8}
          />

          {/* Top Crossarm */}
          <line x1="200" y1="56" x2="284" y2="56" strokeWidth="3" />
          <line x1="230" y1="20" x2="200" y2="56" strokeWidth="2" />
          <line x1="254" y1="20" x2="284" y2="56" strokeWidth="2" />

          {/* Middle Crossarm (Widest) */}
          <line x1="182" y1="96" x2="302" y2="96" strokeWidth="3.2" />
          <line x1="222" y1="56" x2="182" y2="96" strokeWidth="2" />
          <line x1="262" y1="56" x2="302" y2="96" strokeWidth="2" />

          {/* Bottom Crossarm */}
          <line x1="194" y1="136" x2="290" y2="136" strokeWidth="3" />
          <line x1="216" y1="96" x2="194" y2="136" strokeWidth="2" />
          <line x1="268" y1="96" x2="290" y2="136" strokeWidth="2" />

          {/* Internal X-Bracing Lattice */}
          <line x1="228" y1="24" x2="256" y2="54" strokeWidth="1.2" />
          <line x1="256" y1="24" x2="228" y2="54" strokeWidth="1.2" />

          <line x1="222" y1="58" x2="262" y2="94" strokeWidth="1.3" />
          <line x1="262" y1="58" x2="222" y2="94" strokeWidth="1.3" />

          <line x1="216" y1="98" x2="268" y2="134" strokeWidth="1.4" />
          <line x1="268" y1="98" x2="216" y2="134" strokeWidth="1.4" />

          <line x1="208" y1="138" x2="276" y2="176" strokeWidth="1.5" />
          <line x1="276" y1="138" x2="208" y2="176" strokeWidth="1.5" />

          <line x1="200" y1="178" x2="284" y2="200" strokeWidth="1.6" />
          <line x1="284" y1="178" x2="200" y2="200" strokeWidth="1.6" />

          {/* Horizontal Tie Struts */}
          <line x1="209" y1="176" x2="275" y2="176" strokeWidth="1.8" />
        </g>

        {/* Insulator Strings hanging from Crossarms */}
        <g stroke={isNight ? '#67e8f9' : '#334155'} strokeWidth="2" strokeDasharray="2,2">
          <line x1="200" y1="56" x2="200" y2="68" />
          <line x1="284" y1="56" x2="284" y2="68" />
          <line x1="182" y1="96" x2="182" y2="110" />
          <line x1="302" y1="96" x2="302" y2="110" />
          <line x1="194" y1="136" x2="194" y2="150" />
          <line x1="290" y1="136" x2="290" y2="150" />
        </g>

        {/* Transmission Power Lines (Catenary Curves stretching across sky) */}
        <g
          stroke={isNight ? '#00f0ff' : '#0f172a'}
          strokeWidth={isNight ? 1.8 : 1.6}
          opacity={isNight ? 0.95 : 0.85}
          fill="none"
          filter={isNight ? 'url(#pylonElectricNeonGlow)' : undefined}
        >
          {/* Top Circuit Wires */}
          <path d="M 0,42 Q 100,78 200,68" />
          <path d="M 284,68 Q 302,76 320,80" />

          {/* Middle Circuit Wires */}
          <path d="M 0,82 Q 90,122 182,110" />
          <path d="M 302,110 Q 312,116 320,120" />

          {/* Bottom Circuit Wires */}
          <path d="M 0,120 Q 95,158 194,150" />
          <path d="M 290,150 Q 305,157 320,162" />
        </g>

        {/* Night Electric Sparks & Lightning Dots */}
        {isNight && (
          <g fill="#00f0ff" opacity={0.9}>
            <circle cx="200" cy="68" r="2.5" filter="url(#pylonElectricNeonGlow)" />
            <circle cx="182" cy="110" r="2.5" filter="url(#pylonElectricNeonGlow)" />
            <circle cx="194" cy="150" r="2.5" filter="url(#pylonElectricNeonGlow)" />
            <circle cx="242" cy="4" r="2" filter="url(#pylonElectricNeonGlow)" />
            <circle cx="110" cy="98" r="1.5" />
            <circle cx="70" cy="62" r="1.5" />
          </g>
        )}

        {/* Terrain Silhouette at Ground Level */}
        <path
          d="M 130,200 Q 200,186 320,196 L 320,200 Z"
          fill={isNight ? '#020617' : '#15803d'}
          opacity={isNight ? 0.9 : 0.55}
        />
      </svg>
    );
  }

  // Card Watermark View
  return (
    <svg
      viewBox="0 0 160 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g
        stroke={isNight ? '#38bdf8' : '#3b82f6'}
        strokeWidth={1.3}
        opacity={isNight ? 0.38 : 0.24}
      >
        {/* Pylon Legs */}
        <line x1="80" y1="14" x2="44" y2="210" strokeWidth="1.75" />
        <line x1="80" y1="14" x2="116" y2="210" strokeWidth="1.75" />

        {/* Peak Cap */}
        <polygon points="76,14 84,14 80,4" fill={isNight ? '#38bdf8' : '#2563eb'} opacity={0.4} />

        {/* Crossarms */}
        <line x1="56" y1="42" x2="104" y2="42" strokeWidth="2" />
        <line x1="44" y1="72" x2="116" y2="72" strokeWidth="2" />
        <line x1="50" y1="105" x2="110" y2="105" strokeWidth="2" />

        {/* Lattice X-Braces */}
        <line x1="74" y1="18" x2="86" y2="40" />
        <line x1="86" y1="18" x2="74" y2="40" />

        <line x1="68" y1="44" x2="92" y2="70" />
        <line x1="92" y1="44" x2="68" y2="70" />

        <line x1="63" y1="74" x2="97" y2="103" />
        <line x1="97" y1="74" x2="63" y2="103" />

        <line x1="58" y1="107" x2="102" y2="140" />
        <line x1="102" y1="107" x2="58" y2="140" />

        <line x1="52" y1="142" x2="108" y2="180" />
        <line x1="108" y1="142" x2="52" y2="180" />

        {/* Power Line Catenary Curves */}
        <path d="M 0,35 Q 32,49 56,42" fill="none" opacity={0.75} />
        <path d="M 104,42 Q 130,50 160,56" fill="none" opacity={0.75} />

        <path d="M 0,65 Q 24,80 44,72" fill="none" opacity={0.75} />
        <path d="M 116,72 Q 136,82 160,88" fill="none" opacity={0.75} />

        <path d="M 0,95 Q 28,116 50,105" fill="none" opacity={0.75} />
        <path d="M 110,105 Q 132,118 160,124" fill="none" opacity={0.75} />
      </g>
    </svg>
  );
};
