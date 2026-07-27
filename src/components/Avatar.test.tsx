import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('shows the photo when there is one', () => {
    render(<Avatar src="https://example.test/me.jpg" name="Ada" />);
    const img = screen.getByRole('img', { name: 'Ada' });
    expect(img).toHaveAttribute('src', 'https://example.test/me.jpg');
  });

  it('falls back to an initial rather than a broken image', () => {
    // The mock hardcoded Unsplash portraits so an avatar always existed.
    // Real users often have none.
    render(<Avatar src={null} name="Bo" />);
    expect(screen.getByRole('img', { name: 'Bo' })).toHaveTextContent('B');
  });

  it('uppercases the initial regardless of how the name was typed', () => {
    render(<Avatar name="ada" />);
    expect(screen.getByRole('img', { name: 'ada' })).toHaveTextContent('A');
  });

  it('degrades to ? for a user who has not set a name yet', () => {
    render(<Avatar />);
    expect(screen.getByRole('img', { name: 'Profile photo' })).toHaveTextContent('?');
  });

  it('does not crash on a whitespace-only name', () => {
    render(<Avatar name="   " />);
    expect(screen.getByRole('img')).toHaveTextContent('?');
  });

  it('stays accessible in the fallback state', () => {
    // The fallback is a div, so it needs an explicit role and label to be
    // equivalent to the img it replaces.
    render(<Avatar name="Cy" />);
    expect(screen.getByRole('img', { name: 'Cy' })).toBeInTheDocument();
  });
});
