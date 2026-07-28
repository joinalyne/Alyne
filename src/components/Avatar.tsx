/**
 * Profile photo with an initials fallback.
 *
 * The mock hardcoded Unsplash portraits, so every avatar was guaranteed to
 * exist. Real users may not have uploaded one, and a broken image is worse
 * than no image — hence initials on a tinted circle.
 */
export function Avatar({
  src,
  name,
  size = 96,
  className = '',
  borderColor = '#104241',
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  /** Settings rings the avatar in the page background rather than the brand green. */
  borderColor?: string;
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const dimensions = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? 'Profile photo'}
        className={`rounded-full object-cover ${className}`}
        style={{ ...dimensions, border: `3px solid ${borderColor}` }}
      />
    );
  }

  return (
    <div
      aria-label={name ?? 'Profile photo'}
      role="img"
      className={`rounded-full flex items-center justify-center ${className}`}
      style={{
        ...dimensions,
        border: `3px solid ${borderColor}`,
        backgroundColor: '#f5f3f0',
        color: '#a8893f',
        fontSize: size * 0.36,
        fontWeight: 600,
      }}
    >
      {initial}
    </div>
  );
}
