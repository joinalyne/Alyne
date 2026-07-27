# Alyne email templates — where each one goes

All five share the approved treatment: grey #f4f4f4 background, white 20px-radius card,
gold accents, green #104241 CTA, 1px avatar rings, hosted logo at
`joinalyne.com/email/alyne-logo.png` (file: `public/email/alyne-logo.png`;
default avatar: `public/email/default-avatar.png`).

## Supabase templates (Kane pastes — 5 minutes)
Supabase Dashboard → Authentication → Email Templates:
- `supabase-verify-email.html`   → "Confirm signup"
- `supabase-reset-password.html` → "Reset password"
These use Supabase's `{{ .ConfirmationURL }}` variable — paste as-is.
For production deliverability, point Supabase SMTP at Resend (Kane's Resend setup).

## Resend / app templates (Jerome wires the sends)
Sent by application code via Resend's API at these events:
- `waitlist-confirmation.html` → user enters the match queue
- `match-notification.html`    → a match is created (send to BOTH users)
- `inactive-nudge.html`        → partner silent 3+ days (send to the ACTIVE user;
                                 pair is simultaneously flagged in /admin)
Variables are documented in the comment block at the top of each file.
Avatar variables default to `https://joinalyne.com/email/default-avatar.png` when unset.
