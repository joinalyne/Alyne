// Shared email rendering. The leading underscore keeps Vercel from treating
// this as a route while still bundling it for the handlers that import it.

/** The variable names are the contract set by the comment block in each template. */
export type EmailVars = Record<string, string>;

export type RenderResult = {
  html: string;
  /** Placeholders the caller failed to supply. Empty means a clean render. */
  missing: string[];
};

/**
 * Substitute {{placeholders}}.
 *
 * Reports anything left over rather than quietly shipping it. A real send went
 * out reading "Meet your partner, {{name}}." because the sender supplied
 * `user_name` while the template documents `name`; nothing failed, the email
 * was simply wrong. Returning `missing` lets the caller refuse to send, and
 * lets a test assert that every template renders cleanly.
 */
export function render(template: string, vars: EmailVars): RenderResult {
  const html = Object.entries(vars).reduce(
    (out, [key, value]) => out.replaceAll(`{{${key}}}`, value),
    template,
  );

  // Supabase's own variables ({{ .ConfirmationURL }}) are substituted by
  // Supabase, not here, and are identified by the leading dot.
  const missing = [...new Set(html.match(/\{\{\s*[^}\s.][^}]*\}\}/g) ?? [])].map((m) => m.trim());

  return { html, missing };
}

/**
 * Display labels for the six goals.
 *
 * Duplicated from src/lib/goals.ts rather than imported. The client bundle and
 * the serverless function are built separately, and reaching across would drag
 * browser code into the function. A test asserts the two stay identical, which
 * is cheaper than the coupling.
 */
export const GOAL_LABELS: Record<string, string> = {
  fitness: 'Fitness',
  writing: 'Writing',
  learning: 'Learning',
  quitting: 'Quitting',
  mindfulness: 'Mindfulness',
  other: 'Other',
};

/**
 * The variables the v5 match-notification template expects, for one recipient.
 * Names follow the template's own doc block: `name` is the RECIPIENT, not the
 * partner, and `goal_label` is the display label, never the raw enum.
 */
export function matchNotificationVars(opts: {
  appUrl: string;
  recipientName: string | null;
  partnerName: string | null;
  /** The raw enum value from the database, e.g. 'writing'. */
  goal: string;
  recipientAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
}): EmailVars {
  const assetBase = `${opts.appUrl}/email`;
  // v5's default. The gold ring is a CSS border in the template, so a real
  // photo and this glyph are framed identically.
  const fallbackAvatar = `${assetBase}/avatar-glyph.png`;
  return {
    app_url: opts.appUrl,
    asset_base: assetBase,
    name: opts.recipientName ?? 'there',
    partner_name: opts.partnerName ?? 'your partner',
    // v5 renamed {{goal}} to {{goal_label}} precisely because the sender was
    // passing the enum. "Writing", not "writing".
    goal_label: GOAL_LABELS[opts.goal] ?? 'Other',
    avatar_url: opts.recipientAvatarUrl || fallbackAvatar,
    partner_avatar_url: opts.partnerAvatarUrl || fallbackAvatar,
    // Points at Settings until notification preferences exist, per Salomeh.
    unsubscribe_url: `${opts.appUrl}/settings`,
  };
}
