import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Password input with a reveal toggle.
 *
 * Shared rather than repeated, because there are two password screens and they
 * must behave identically: someone who learns the toggle on sign-up should find
 * it in the same place when resetting.
 *
 * The visible state deliberately does NOT persist across fields or renders.
 * Revealing is for checking a typo in the moment, not a preference, and a
 * password left on screen after the user has moved on is a shoulder-surfing risk
 * on a phone.
 */
/**
 * Two looks, because the same field appears on two different grounds.
 * 'bordered' is the original: white fill on the grey page. 'filled' is for the
 * white card on `/`, where a white input would have no edge at all.
 */
const FIELD = {
  bordered: {
    className: 'rounded-[18px] border-2',
    style: {
      borderColor: 'rgba(43, 43, 43, 0.1)',
      backgroundColor: '#FFFFFF',
      boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
    },
  },
  filled: {
    className: 'rounded-[18px] border-[1.5px] border-transparent focus:border-[#1A3328]',
    style: { backgroundColor: '#FAF8F5' },
  },
} as const;

export function PasswordField({
  value,
  onChange,
  placeholder = 'Password',
  autoComplete,
  required = true,
  variant = 'bordered',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  variant?: keyof typeof FIELD;
}) {
  const [visible, setVisible] = useState(false);
  const field = FIELD[variant];

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        // Right padding leaves room for the button so long passwords do not run
        // underneath it.
        className={`w-full pl-6 pr-14 py-4 text-[1rem] transition-all duration-200 focus:outline-none ${field.className}`}
        style={{ color: '#2b2b2b', ...field.style }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // The label states what the button DOES, not what is currently showing,
        // which is what a screen reader user needs to hear.
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        // type="button" matters: inside a form, the default is submit, so
        // revealing the password would submit the form instead.
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10"
        style={{ color: '#8A8580' }}
      >
        {visible ? (
          <EyeOff size={19} strokeWidth={1.5} />
        ) : (
          <Eye size={19} strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}
