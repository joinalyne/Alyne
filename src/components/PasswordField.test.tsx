import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('starts masked', () => {
    render(<PasswordField value="hunter2" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
  });

  it('reveals and re-hides on the toggle', () => {
    render(<PasswordField value="hunter2" onChange={() => {}} />);
    const field = screen.getByPlaceholderText('Password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field).toHaveAttribute('type', 'password');
  });

  it('labels what the button DOES, not what is showing', () => {
    // A screen reader user needs the action, not the current state.
    render(<PasswordField value="x" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });

  it('exposes pressed state for assistive technology', () => {
    render(<PasswordField value="x" onChange={() => {}} />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('is type=button, so revealing cannot submit the form', () => {
    // Inside a form the default is submit, which would sign the user in the
    // instant they tried to check their typing.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField value="x" onChange={() => {}} />
      </form>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reports every keystroke to the caller', () => {
    const onChange = vi.fn();
    render(<PasswordField value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('accepts a custom placeholder, for the reset screen', () => {
    render(<PasswordField value="" onChange={() => {}} placeholder="New password" />);
    expect(screen.getByPlaceholderText('New password')).toBeInTheDocument();
  });
});
