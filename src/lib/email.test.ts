import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, matchNotificationVars, inactiveNudgeVars, GOAL_LABELS } from '../../api/_email';
import { GOAL_LABELS as CLIENT_GOAL_LABELS } from './goals';

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
  // The raw enum, exactly as the database hands it to the sender.
  const vars = matchNotificationVars({
    appUrl: 'https://app.joinalyne.com',
    recipientName: 'Ada',
    partnerName: 'Bo',
    goal: 'writing',
  });

  it('renders with nothing left over', () => {
    const { missing } = render(template('match-notification.html'), vars);
    expect(missing).toEqual([]);
  });

  it('addresses the recipient and introduces the partner, the right way round', () => {
    // The v5 headline is "{{name}}, meet {{partner_name}}." Getting these
    // reversed would send each person an email about themselves.
    const { html } = render(template('match-notification.html'), vars);
    expect(html).toContain('Ada, meet Bo.');
    expect(html).not.toContain('Bo, meet Ada.');
  });

  it('shows the goal LABEL, never the raw enum', () => {
    // v5 renamed {{goal}} to {{goal_label}} because the sender was passing the
    // database value straight through, so the email would read "writing".
    expect(vars.goal_label).toBe('Writing');
    const { html } = render(template('match-notification.html'), vars);
    expect(html).toContain('>Writing.<');
    expect(html).not.toContain('>writing.<');
  });

  it('degrades an unknown goal rather than leaking it raw', () => {
    const odd = matchNotificationVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: 'Ada', partnerName: 'Bo', goal: 'gardening',
    });
    expect(odd.goal_label).toBe('Other');
  });

  it('supplies an unsubscribe link', () => {
    expect(vars.unsubscribe_url).toBe('https://app.joinalyne.com/settings');
  });

  it('defaults to the v5 glyph, not the retired default-avatar', () => {
    expect(vars.avatar_url).toContain('avatar-glyph.png');
    expect(vars.avatar_url).not.toContain('default-avatar.png');
  });

  it('never points an image at the Wix marketing domain', () => {
    // v5 hardcodes app.joinalyne.com for the logo and CTA, which is correct now
    // the subdomain is live. What must never happen is an image resolving to the
    // Wix site, where /email/ does not exist - that was the broken-logo bug.
    const { html } = render(template('match-notification.html'), vars);
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    expect(images.length).toBeGreaterThan(0);
    for (const src of images) {
      expect(src).not.toMatch(/^https:\/\/(www\.)?joinalyne\.com/);
    }
  });

  it('keeps the server-side goal labels identical to the client ones', () => {
    // Duplicated deliberately, so this guards the copy rather than the coupling.
    expect(GOAL_LABELS).toEqual(CLIENT_GOAL_LABELS);
  });

  it('falls back to a default avatar rather than an empty src', () => {
    const withoutPhotos = matchNotificationVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: 'Ada',
      partnerName: 'Bo',
      goal: 'writing',
      recipientAvatarUrl: null,
      partnerAvatarUrl: null,
    });
    expect(withoutPhotos.avatar_url).toContain('avatar-glyph.png');
    expect(withoutPhotos.partner_avatar_url).toContain('avatar-glyph.png');
  });

  it('copes with a user who never set a name', () => {
    const anon = matchNotificationVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: null,
      partnerName: null,
      goal: 'fitness',
    });
    const { html, missing } = render(template('match-notification.html'), anon);
    expect(missing).toEqual([]);
    expect(html).toContain('there, meet your partner.');
  });
});

describe('inactive-nudge template', () => {
  const vars = inactiveNudgeVars({
    appUrl: 'https://app.joinalyne.com',
    recipientName: 'Ada',
    partnerName: 'Bo',
    daysSilent: 4,
  });

  it('renders with nothing left over', () => {
    const { missing } = render(template('inactive-nudge.html'), vars);
    expect(missing).toEqual([]);
  });

  it('addresses the ACTIVE partner and names the silent one', () => {
    // Reversed, this would tell someone off for their own absence.
    expect(vars.name).toBe('Ada');
    expect(vars.partner_name).toBe('Bo');
  });

  it('passes the silence length as a string, since templates are text', () => {
    expect(vars.days).toBe('4');
  });

  it('uses the SILENT partner initial for the fallback avatar', () => {
    expect(vars.initial).toBe('B');
  });

  it('never leaves a placeholder visible for an unnamed partner', () => {
    const anon = inactiveNudgeVars({
      appUrl: 'https://app.joinalyne.com',
      recipientName: null, partnerName: null, daysSilent: 3,
    });
    const { html, missing } = render(template('inactive-nudge.html'), anon);
    expect(missing).toEqual([]);
    expect(html).not.toContain('{{');
  });

  it('never points an image at the Wix marketing domain', () => {
    const { html } = render(template('inactive-nudge.html'), vars);
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    for (const src of images) {
      expect(src).not.toMatch(/^https:\/\/(www\.)?joinalyne\.com/);
    }
  });
});

describe('waitlist-confirmation template', () => {
  it('renders with the variables it declares', () => {
    const { missing } = render(template('waitlist-confirmation.html'), {
      app_url: 'https://app.joinalyne.com',
      asset_base: 'https://app.joinalyne.com/email',
      name: 'Ada',
      goal_label: 'Writing',
      unsubscribe_url: 'https://app.joinalyne.com/settings',
    });
    expect(missing).toEqual([]);
  });
});
