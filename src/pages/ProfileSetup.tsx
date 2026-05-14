import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void navigate('/goal-selection')
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-[1.75rem] tracking-tight" style={{ color: '#1A3328', fontWeight: 600 }}>
            Let&apos;s set up your profile.
          </h1>
          <p className="text-[1rem] text-[#2b2b2b]/60">Your partner will see this.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 pt-4">
          <div className="flex flex-col items-center space-y-3">
            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <label
              htmlFor="photo-upload"
              className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:opacity-80"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#a8893f"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </label>
            <label
              htmlFor="photo-upload"
              className="cursor-pointer text-[0.9rem] text-[#2b2b2b]/50 transition-opacity hover:opacity-100"
            >
              Add a photo
            </label>
          </div>

          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              className="w-full rounded-[1.25rem] border-2 px-6 py-4 text-[1rem] transition-all duration-200 focus:outline-none"
              style={{
                borderColor: 'rgba(43, 43, 43, 0.1)',
                color: '#2b2b2b',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              marginTop: '5px',
            }}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  )
}
