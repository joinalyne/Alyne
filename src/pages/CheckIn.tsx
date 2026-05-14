import { Camera, Edit3, Mic } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

export default function CheckIn() {
  const navigate = useNavigate()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const partner = { name: 'Jamie' }

  const today = new Date()
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const checkInOptions = [
    {
      id: 'photo',
      title: 'Photo',
      subtitle: 'Show us where you are',
      icon: Camera,
      color: '#a8893f',
    },
    {
      id: 'voice',
      title: 'Voice Note',
      subtitle: 'Say how it went',
      icon: Mic,
      color: '#a8893f',
    },
    {
      id: 'text',
      title: 'Quick Update',
      subtitle: 'A few words is enough',
      icon: Edit3,
      color: '#a8893f',
    },
  ] as const

  function handleSend() {
    void navigate('/home')
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-6 pt-12">
        <div className="space-y-1 text-center">
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-[#2b2b2b]">
            Today&apos;s Check-In
          </h1>
          <p className="text-[0.85rem] text-[#2b2b2b]/50">{dateString}</p>
        </div>

        <div className="space-y-3 pt-4">
          {checkInOptions.map((option) => {
            const Icon = option.icon
            const isSelected = selectedOption === option.id

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedOption(option.id)}
                className="w-full rounded-[1.25rem] bg-white p-5 text-left transition-all duration-200 active:scale-[0.98]"
                style={{
                  boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
                  border: isSelected ? '2px solid #104241' : '2px solid rgba(43, 43, 43, 0.08)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#f5f3f0' }}
                  >
                    <Icon size={23} color={option.color} strokeWidth={1.25} />
                  </div>
                  <div className="flex-1">
                    <p className="mb-0.5 text-[1rem] font-semibold text-[#2b2b2b]">{option.title}</p>
                    <p className="text-[0.85rem] text-[#2b2b2b]/60">{option.subtitle}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{
            maxHeight: selectedOption === 'text' ? '200px' : '0',
            opacity: selectedOption === 'text' ? 1 : 0,
          }}
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How did it go today?"
            className="w-full resize-none rounded-[1.25rem] border-2 border-[rgba(16,66,65,0.1)] bg-white p-5 text-[0.95rem] text-[#2b2b2b] transition-all focus:outline-none"
            style={{
              minHeight: '120px',
              boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
            }}
            rows={4}
          />
        </div>

        <div className="space-y-3 pt-6">
          <button
            type="button"
            onClick={handleSend}
            className="w-full rounded-[1.25rem] py-5 text-[1.1rem] font-semibold text-white transition-all duration-200 active:scale-[0.98]"
            style={{
              backgroundColor: '#104241',
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)',
            }}
          >
            Send to {partner.name}
          </button>

          <p className="px-4 text-center text-[0.85rem] text-[#2b2b2b]/50">
            {partner.name} will be notified when you check in.
          </p>
        </div>
      </div>
    </div>
  )
}
