# Alyne email templates — where each one goes

All five share the approved treatment: grey #f4f4f4 background, white 20px-radius card,
gold accents, green #104241 CTA, 1px avatar rings.

## Where the images come from — read this before changing a host

`joinalyne.com` is the Wix marketing site. The image files live in this repo at
`public/email/`, so they deploy to the **app**, not to the marketing domain.
The templates originally hardcoded `https://joinalyne.com/email/alyne-logo.png`,
which 404s. Every email would have arrived with a broken logo.

Hosts are now variables, so the app's address is set in one place:

| Placeholder      | Meaning                          | Set by                          |
|------------------|----------------------------------|---------------------------------|
| `{{asset_base}}` | where `/email/*.png` is served   | `APP_URL` + `/email`, at send   |
| `{{app_url}}`    | the CTA target, i.e. the app     | `APP_URL` env var               |
| `{{ .SiteURL }}` | Supabase's own variable          | Auth -> URL Configuration       |

The two Supabase-pasted templates use `{{ .SiteURL }}` and so need no
substitution at all — they follow whatever Site URL is configured.

`APP_URL` is `https://app.joinalyne.com` (agreed 2026-07-27). The app sits at the
root of that subdomain, so CTA links are `{{app_url}}`, never `{{app_url}}/app`.

### The three remaining `joinalyne.com` links are correct — do not change them

`inactive-nudge`, `match-notification` and `waitlist-confirmation` each end with
"You're receiving this because ... on joinalyne.com". Those point at the Wix
marketing site on purpose: it is the public face of the brand, it resolves, and
an unsubscribe-context footer should go there rather than into the app. Every
link that needed to become the app host already has.

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
Avatar variables default to `{{asset_base}}/default-avatar.png` when unset.
