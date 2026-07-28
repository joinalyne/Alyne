import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, matchNotificationVars } from '../../api/_email';

// cwd rather than import.meta.url: on Windows the URL form resolved to
// C:\emails under the jsdom environment. Vitest always runs from the repo root.
const template = (name: string) => readFileSync(join(process.cwd(), 'emails', name), 'utf8');

describe('render', () => {
  it('substitutes what it is given', () => {
    expect(render('Hi {{name}}', { name: 'Ada' }).html).toBe('Hi Ada');
  });

  it('reports a placeholder the caller forgot', () => {
    // The bug this exists for: a real send went out reading
    // "Meet your partner, {{name}}." because the sender supplied `user_name`
    // while the template documents `name`. Nothing failed; the email was wrong.
    const { missing } = render('Hi {{name}}, meet {{partner_name}}', { name: 'Ada' });
    expect(missing).toEqual(['{{partner_name}}']);
  });

  it('ignores Supabase variables, which Supabase substitutes', () => {
    const { missing } = render('<a href="{{ .ConfirmationURL }}">Confirm</a>', {});
    expect(missing).toEqual([]);
  });

  it('replaces every occurrence, not just the first', () => {
    expect(render('{{n}} and {{n}}', { n: 'x' }).html).toBe('x and x');
  });
});

describe('match-notification template', () => {
  const vars = matchNotificationVars({
    appUrl: 'https://app.joinalyne.com',
    recipientName: 'Ada',
    partnerName: 'Bo',
    goal: 'Writing',
  });

  it('renders with nothing left over', () => {
    const { missing } = render(template('match-notification.html'), vars);
    expect(missing).toEqual([]);
  });

  it('addresses the recipient, not the partner', () => {
    const { html } = render(template('match-notification.html'), vars);
    expect(html).toContain('Meet your partner, Ada.');
    expect(html).not.toContain('Meet your partner, Bo.');
  });

  it('points images and the CTA at the app, never the Wix marketing site', () => {
    const { html } = render(template('match-notification.html'), vars);
    expect(html).toContain('https://app.joinalyne.com/email/alyne-logo.png');
    // joinalyne.com without the app subdomain may appear only in the footer
    // brand link, never on an image or the CTA.
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(images.every((src) => src.startsWith('https://app.joinalyne.com'))).toBe(true);
  });

  it('falls back to a default avatar rather than an empty src', () => {
    const withoutPhotos = matchNotificationVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: 'Ada',
      partnerName: 'Bo',
      goal: 'Writing',
      recipientAvatarUrl: null,
      partnerAvatarUrl: null,
    });
    expect(withoutPhotos.avatar_url).toContain('default-avatar.png');
    expect(withoutPhotos.partner_avatar_url).toContain('default-avatar.png');
  });

  it('copes with a user who never set a name', () => {
    const anon = matchNotificationVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: null,
      partnerName: null,
      goal: 'Fitness',
    });
    const { html, missing } = render(template('match-notification.html'), anon);
    expect(missing).toEqual([]);
    expect(html).toContain('Meet your partner, there.');
  });
});
