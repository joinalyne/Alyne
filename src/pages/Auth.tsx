import { AlyneWordmark } from '../components/AlyneWordmark';
import { useState } from 'react';
import { Link } from 'react-router';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(isSignUp ? 'Sign up' : 'Log in', { email, password });
    // Handle authentication logic here
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <AlyneWordmark className="w-24 mx-auto mb-6" />
          <h1
            className="text-[1.1rem] tracking-tight"
            style={{ color: '#a8893f' }}
          >
            {isSignUp ? 'Your journey starts here.' : 'Welcome back.'}
          </h1>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={{
                borderColor: 'rgba(43, 43, 43, 0.1)',
                color: '#2b2b2b',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)'
              }}
            />
          </div>

          {/* Password Input */}
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={{
                borderColor: 'rgba(43, 43, 43, 0.1)',
                color: '#2b2b2b',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)'
              }}
            />
          </div>

          {/* Forgot password (log-in mode only) */}
          {!isSignUp && (
            <div className="text-right px-2">
              <Link
                to="/reset-password"
                className="text-[0.875rem]"
                style={{ fontWeight: 600, color: '#a8893f' }}
              >
                Forgot password?
              </Link>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              marginTop: '2rem'
            }}
          >
            {isSignUp ? 'Get Started' : 'Log In'}
          </button>
        </form>

        {/* Toggle Link */}
        <div className="text-center pt-4">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-[0.95rem] transition-opacity hover:opacity-100"
            style={{ color: '#8A8580' }}
          >
            {isSignUp ? (
              <>Already have an account? <span style={{ fontWeight: 600, color: '#a8893f' }}>Log in</span></>
            ) : (
              <>Don't have an account? <span style={{ fontWeight: 600, color: '#a8893f' }}>Sign up</span></>
            )}
          </button>
        </div>

        {/* Optional: Link back to landing */}
        <div className="text-center pt-8">
          <Link
            to="/"
            className="text-[0.85rem] transition-opacity hover:opacity-100"
            style={{ color: '#8A8580' }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
