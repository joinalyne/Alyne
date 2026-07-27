import { AlyneWordmark } from '../components/AlyneWordmark';
import { Link } from 'react-router';

export default function Matched() {
  // Mock data
  const currentUser = {
    name: "You",
    photo: "https://images.unsplash.com/photo-1581564018992-95e729d4940e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMHdvbWFuJTIwcG9ydHJhaXQlMjBuYXR1cmFsfGVufDF8fHx8MTc3NTA2ODc4Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  };

  const partner = {
    name: "Jamie",
    photo: "https://images.unsplash.com/photo-1640653583383-72b60809f273?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRseSUyMG1hbiUyMHBvcnRyYWl0JTIwc21pbGluZ3xlbnwxfHx8fDE3NzUwNjg3ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  };

  const sharedGoal = "Practice daily meditation";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center">
          <AlyneWordmark className="w-24 mx-auto" />
        </div>

        {/* Profile Photos */}
        <div className="flex items-center justify-center gap-6 pt-4">
          {/* Current User */}
          <div className="flex flex-col items-center">
            <img
              src={currentUser.photo}
              alt={currentUser.name}
              className="w-24 h-24 rounded-full object-cover"
              style={{ border: '3px solid #104241' }}
            />
          </div>

          {/* Connector Line */}
          <div className="h-[1px] w-10 rounded-full" style={{ backgroundColor: '#a8893f' }}></div>

          {/* Partner */}
          <div className="flex flex-col items-center">
            <img
              src={partner.photo}
              alt={partner.name}
              className="w-24 h-24 rounded-full object-cover"
              style={{ border: '3px solid #104241' }}
            />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3 pt-2">
          <h1
            className="text-[1.45rem] tracking-tight leading-tight"
            style={{ color: '#a8893f', fontWeight: 600 }}
          >
            You've been matched with {partner.name}!
          </h1>
          <p
            className="text-[1.05rem] leading-relaxed px-4"
            style={{ color: '#8A8580' }}
          >
            You're both working toward the same goal. Now hold each other to it.
          </p>
        </div>

        {/* Shared Goal Card */}
        <div className="bg-white rounded-[1.25rem] p-6 text-center" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)' }}>
          <p className="text-[0.75rem] uppercase tracking-wide mb-3" style={{ color: '#8A8580', fontWeight: 600, letterSpacing: '0.07em' }}>
            Shared Goal
          </p>
          <p className="text-[1.1rem]" style={{ color: '#2b2b2b', fontWeight: 500 }}>
            {sharedGoal}
          </p>
        </div>

        {/* CTA Button */}
        <div className="space-y-3 pt-4">
          <Link to="/home">
            <button
              className="w-full rounded-[1.25rem] py-4 transition-all duration-200 active:scale-[0.98]"
              style={{
                backgroundColor: '#104241',
                color: '#FFFFFF',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)'
              }}
            >
              Say Hello 👋
            </button>
          </Link>
          <p className="text-center text-[0.85rem] pt-4" style={{ color: '#8A8580' }}>
            {partner.name} will be notified that you've matched.
          </p>
        </div>

      </div>
    </div>
  );
}
