import { useState } from 'react';
import { useNavigate } from 'react-router';
import { updateDisplayName, uploadAvatar } from '../lib/supabase';
import { useAuth } from '../contexts/useAuth';
import { Alert } from '../components/Alert';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  const [typedName, setTypedName] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  // The preview is a data URL for display; the File itself is what gets
  // uploaded, so both have to be kept.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived, not synced from an effect: the profile loads asynchronously, so
  // copying it into state would clobber what the user has already typed when
  // it eventually arrives. `?? ''` keeps the input controlled throughout.
  const name = typedName ?? profile?.display_name ?? '';
  const photoPreview = localPreview ?? profile?.avatar_url ?? null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Name first: it is the required field, and an avatar failing should not
      // cost the user their name.
      const named = await updateDisplayName(name.trim());
      if (!named) throw new Error('Could not save your name. Please try again.');

      if (photoFile) {
        const url = await uploadAvatar(photoFile);
        if (!url) setError('Your name was saved, but the photo would not upload.');
      }

      await refreshProfile();
      navigate('/goal-selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1
            className="text-[1.75rem] tracking-tight"
            style={{ color: '#1A3328', fontWeight: 600 }}
          >
            Let's set up your profile.
          </h1>
          <p
            className="text-[1rem]"
            style={{ color: '#8A8580' }}
          >
            Your partner will see this.
          </p>
        </div>

        {error ? (
          <Alert>{error}</Alert>
        ) : null}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8 pt-4">

          {/* Photo Upload */}
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
              className="cursor-pointer flex items-center justify-center w-32 h-32 rounded-full transition-all duration-200 hover:opacity-80"
              style={{
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)'
              }}
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="w-full h-full rounded-full object-cover"
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
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </label>
            <label
              htmlFor="photo-upload"
              className="text-[0.9rem] cursor-pointer transition-opacity hover:opacity-100"
              style={{ color: '#8A8580' }}
            >
              {photoPreview ? 'Change photo' : 'Add a photo'}
            </label>
          </div>

          {/* Name Input */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="given-name"
              className="w-full px-6 py-4 rounded-[1.25rem] border-2 text-[1rem] transition-all duration-200 focus:outline-none"
              style={{
                borderColor: 'rgba(43, 43, 43, 0.1)',
                color: '#2b2b2b',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 2px 12px rgba(43, 43, 43, 0.03)'
              }}
            />
          </div>

          {/* Continue Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            style={{
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
              marginTop: '5px'
            }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>

      </div>
    </div>
  );
}
