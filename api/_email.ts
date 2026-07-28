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
 * The variables the match-notification template expects, for one recipient.
 * Names follow the template's own doc block: `name` is the RECIPIENT, not the
 * partner.
 */
export function matchNotificationVars(opts: {
  appUrl: string;
  recipientName: string | null;
  partnerName: string | null;
  goal: string;
  recipientAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
}): EmailVars {
  const assetBase = `${opts.appUrl}/email`;
  const fallbackAvatar = `${assetBase}/default-avatar.png`;
  return {
    app_url: opts.appUrl,
    asset_base: assetBase,
    name: opts.recipientName ?? 'there',
    partner_name: opts.partnerName ?? 'your partner',
    goal: opts.goal,
    avatar_url: opts.recipientAvatarUrl || fallbackAvatar,
    partner_avatar_url: opts.partnerAvatarUrl || fallbackAvatar,
  };
}
