import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ImageWithFallback } from '../components/alyne/ImageWithFallback'

export default function Auth() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void navigate('/profile-setup')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <ImageWithFallback
            src="/alyne-logo.png"
            alt="alyne"
            className="mx-auto mb-6 w-40"
          />
          <p
            className="text-[1.05rem]"
            style={{ color: '#B8860B' }}
          >
            Your journey starts here.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-12 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full rounded-full bg-white px-7 py-5 text-[1rem] placeholder:text-[#9a9a96] focus:outline-none"
            style={{
              color: '#1D3D38',
              boxShadow: '0 1px 2px rgba(29, 61, 56, 0.04)',
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full rounded-full bg-white px-7 py-5 text-[1rem] placeholder:text-[#9a9a96] focus:outline-none"
            style={{
              color: '#1D3D38',
              boxShadow: '0 1px 2px rgba(29, 61, 56, 0.04)',
            }}
          />

          <button
            type="submit"
            className="mt-8 w-full rounded-full py-5 text-[1.05rem] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#1D3D38',
              boxShadow: '0 4px 16px rgba(29, 61, 56, 0.18)',
            }}
          >
            Get Started
          </button>
        </form>

        <p className="mt-10 text-center text-[0.95rem]" style={{ color: '#1D3D38' }}>
          Already have an account?{' '}
          <button
            type="button"
            className="font-semibold"
            style={{ color: '#B8860B' }}
          >
            Log in
          </button>
        </p>

        <div className="mt-16 text-center">
          <Link
            to="/home"
            className="text-[0.95rem]"
            style={{ color: '#9a9a96' }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
