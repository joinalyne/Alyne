interface SunIconProps {
  size?: number;
  color?: string;
}

export function SunIcon({ size = 24, color = '#104241' }: SunIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Center circle */}
      <circle 
        cx="12" 
        cy="12" 
        r="4" 
        stroke={color} 
        strokeWidth="1.5" 
        fill="none"
      />
      
      {/* 6 rays evenly spaced (60 degrees apart) */}
      {/* Top ray (0°) */}
      <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Top-right ray (60°) */}
      <line x1="18.66" y1="5.34" x2="16.24" y2="7.76" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Bottom-right ray (120°) */}
      <line x1="18.66" y1="18.66" x2="16.24" y2="16.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Bottom ray (180°) */}
      <line x1="12" y1="22" x2="12" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Bottom-left ray (240°) */}
      <line x1="5.34" y1="18.66" x2="7.76" y2="16.24" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Top-left ray (300°) */}
      <line x1="5.34" y1="5.34" x2="7.76" y2="7.76" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
