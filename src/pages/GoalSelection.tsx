import { Dumbbell, PenLine, BookOpen, Unlock, Sparkles, MoreHorizontal, Check } from 'lucide-react';
import { useState } from 'react';

export default function GoalSelection() {
  const [selectedGoal, setSelectedGoal] = useState<string | null>('fitness');

  const goals = [
    {
      id: 'fitness',
      label: 'Fitness',
      icon: Dumbbell,
    },
    {
      id: 'writing',
      label: 'Writing',
      icon: PenLine,
    },
    {
      id: 'learning',
      label: 'Learning',
      icon: BookOpen,
    },
    {
      id: 'quitting',
      label: 'Quitting',
      icon: Unlock,
    },
    {
      id: 'mindfulness',
      label: 'Mindfulness',
      icon: Sparkles,
    },
    {
      id: 'other',
      label: 'Other',
      icon: MoreHorizontal,
    },
  ];

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId);
  };

  const handleFindPartner = () => {
    console.log('Finding partner for goal:', selectedGoal);
    // Handle find partner logic here
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6">
      <div className="w-full max-w-md space-y-8 pt-12">
        
        {/* Header */}
        <div className="text-center space-y-2 px-4">
          <h1 className="text-[1.85rem] tracking-tight leading-tight" style={{ color: '#2b2b2b', fontWeight: 600 }}>
            What are you working on?
          </h1>
          <p className="text-[0.95rem] leading-relaxed" style={{ color: '#8A8580' }}>
            We'll find you a partner chasing the same thing.
          </p>
        </div>

        {/* Goal Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const isSelected = selectedGoal === goal.id;
            
            return (
              <button
                key={goal.id}
                onClick={() => handleGoalSelect(goal.id)}
                className="relative bg-white rounded-[1.25rem] p-6 transition-all duration-200 active:scale-[0.98] flex flex-col items-center justify-center gap-3 min-h-[140px]"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: isSelected ? '1.5px solid #1A3328' : '1.5px solid transparent',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.07)'
                }}
              >
                {/* Checkmark for selected state */}
                {isSelected && (
                  <div
                    className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full"
                    style={{ backgroundColor: '#104241' }}
                  >
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  </div>
                )}

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-full"
                  style={{ backgroundColor: '#f5f3f0' }}
                >
                  <Icon
                    size={24}
                    color="#A8893F"
                    strokeWidth={1.5}
                  />
                </div>

                {/* Label */}
                <p 
                  className="text-[0.95rem] text-center leading-snug" 
                  style={{ 
                    color: '#2b2b2b', 
                    fontWeight: isSelected ? 600 : 500 
                  }}
                >
                  {goal.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Find Partner Button */}
        <div className="space-y-3 pt-6">
          <button 
            onClick={handleFindPartner}
            className="w-full rounded-[1.25rem] py-5 transition-all duration-200 active:scale-[0.98]"
            style={{ 
              backgroundColor: '#104241',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(16, 66, 65, 0.25)'
            }}
          >
            Find My Partner
          </button>

          <p className="text-center text-[0.85rem] px-4 leading-relaxed" style={{ color: '#8A8580' }}>
            Your partner will have the same goal. <br />
            You'll be matched within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}