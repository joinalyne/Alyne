import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name.')
      return
    }

    setError(null)
    setSaving(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user) {
        void navigate('/')
        return
      }

      let avatarUrl: string | undefined
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/avatar.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, photoFile, {
            upsert: true,
            contentType: photoFile.type,
          })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            name: trimmed,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          },
          { onConflict: 'user_id' },
        )

      if (upsertError) throw upsertError

      void navigate('/goal-selection')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-[1.5rem] tracking-tight" style={{ color: '#1A3328', fontWeight: 600 }}>
            Let&apos;s set up your profile.
          </h1>
          <p className="text-[0.95rem] text-[#2b2b2b]/60">Your partner will see this.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center space-y-2">
            <input
              type="file"
              id="photo-upload"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <label
              htmlFor="photo-upload"
              className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:opacity-80"
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
                  width="32"
                  height="32"
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
              className="cursor-pointer text-[0.85rem] text-[#2b2b2b]/50 transition-opacity hover:opacity-100"
            >
              {photoFile ? 'Change photo' : 'Add a photo'}
            </label>
          </div>

          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              disabled={saving}
              className="w-full rounded-[1.25rem] border-2 px-6 py-3.5 text-[1rem] transition-all duration-200 focus:outline-none disabled:opacity-60"
              style={{
                borderColor: 'rgba(43, 43, 43, 0.1)',
                color: '#2b2b2b',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)',
              }}
            />
          </div>

          {error ? (
            <p
              className="rounded-2xl bg-red-50 px-4 py-2.5 text-center text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[1.25rem] py-3.5 transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
            }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
