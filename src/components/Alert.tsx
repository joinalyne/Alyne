/**
 * Inline error message.
 *
 * Exists because six screens had grown their own error banner with the same
 * hand-picked red, #9b2c2c on #fdf2f2, which I invented rather than took from
 * the design. Salomeh's theme already defines --destructive (#d4183d), so the
 * app was carrying two different reds and only one of them was hers.
 *
 * The tint is derived from her destructive colour rather than being a second
 * hardcoded value, so changing the token changes both.
 */
export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-[1.25rem] px-5 py-3 text-center text-[0.9rem]"
      style={{
        color: 'var(--destructive)',
        backgroundColor: 'color-mix(in srgb, var(--destructive) 8%, #FFFFFF)',
      }}
    >
      {children}
    </p>
  );
}
