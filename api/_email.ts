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

  // Comments are stripped before scanning for leftovers. Salomeh documents the
  // expected variables in an HTML comment at the top of each template, so
  // scanning the raw document reported every documented name as "missing" even
  // when the markup used none of them.
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');

  // Supabase's own variables ({{ .ConfirmationURL }}) are substituted by
  // Supabase, not here, and are identified by the leading dot.
  const missing = [
    ...new Set(withoutComments.match(/\{\{\s*[^}\s.][^}]*\}\}/g) ?? []),
  ].map((m) => m.trim());

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
 * Variables for the inactive-partner nudge (v2 template).
 *
 * Sent to the person still showing up, about the one who has gone quiet, so
 * `name` is the ACTIVE partner and `partner_name` is the silent one. Getting
 * those the wrong way round would tell someone off for their own absence.
 */
export function inactiveNudgeVars(opts: {
  appUrl: string;
  recipientName: string | null;
  partnerName: string | null;
  daysSilent: number;
  recipientAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
}): EmailVars {
  const assetBase = `${opts.appUrl}/email`;
  const fallbackAvatar = `${assetBase}/avatar-glyph.png`;
  return {
    app_url: opts.appUrl,
    asset_base: assetBase,
    name: opts.recipientName ?? 'there',
    partner_name: opts.partnerName ?? 'your partner',
    days: String(opts.daysSilent),
    initial: initialFor(opts.partnerName),
    avatar_url: opts.recipientAvatarUrl || fallbackAvatar,
    partner_avatar_url: opts.partnerAvatarUrl || fallbackAvatar,
    unsubscribe_url: `${opts.appUrl}/settings`,
  };
}

/**
 * Swap an avatar <img> for an initials circle when there is no photo.
 *
 * v5 replaced the glyph fallback with initials, and email cannot do conditionals,
 * so the sender has to make the choice. Targeted by PLACEHOLDER NAME rather than
 * by matching her styling, so restyling the image does not silently break this.
 *
 * Markup and colours are hers, from the instruction block in the template:
 * #104241 for the recipient, #A8893F for the partner.
 */
export function applyAvatar(
  html: string,
  placeholder: 'avatar_url' | 'partner_avatar_url',
  photoUrl: string | null,
  initial: string,
  colour: string,
): string {
  if (photoUrl) return html; // leave the <img> as-is, per her note

  const imgTag = new RegExp(`<img[^>]*src="\{\{${placeholder}\}\}"[^>]*>`);
  const initialsCircle =
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"' +
    ' style="margin:0 auto; border-collapse:separate;"><tr>' +
    '<td align="center" valign="middle" width="80" height="80"' +
    ' style="width:80px; height:80px; border-radius:50%; background-color:#F5F3F0;">' +
    `<span style="font-family:'Lora',Georgia,serif; font-size:36px; font-weight:700;` +
    ` color:${colour};">${initial}</span>` +
    '</td></tr></table>';

  return html.replace(imgTag, initialsCircle);
}

/** First letter, uppercased, or a neutral mark when there is no name at all. */
export function initialFor(name: string | null): string {
  const letter = name?.trim()?.[0];
  return letter ? letter.toUpperCase() : '?';
}

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
