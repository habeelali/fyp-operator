'use client';

import { Navigation, Gamepad2, Pause } from 'lucide-react';

type UGVState = 'idling' | 'tele-op' | 'autonomous';

export default function SystemState({ state }: { state: UGVState }) {
  const states = [
    { 
      id: 'idling' as UGVState, 
      label: 'Idling', 
      icon: Pause, 
      color: 'gray',
      bgColor: 'bg-gray-900',
      borderColor: 'border-gray-700',
      iconColor: 'text-gray-400'
    },
    { 
      id: 'tele-op' as UGVState, 
      label: 'Teleoperation', 
      icon: Gamepad2, 
      color: 'blue',
      bgColor: 'bg-blue-900/30',
      borderColor: 'border-blue-600',
      iconColor: 'text-blue-500'
    },
    { 
      id: 'autonomous' as UGVState, 
      label: 'Autonomous Exploration', 
      icon: Navigation, 
      color: 'green',
      bgColor: 'bg-green-900/30',
      borderColor: 'border-green-600',
      iconColor: 'text-green-500'
    },
  ];

  const currentState = states.find(s => s.id === state) || states[0];

  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Current State</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {states.map((s) => {
          const Icon = s.icon;
          const isActive = s.id === state;
          
          return (
            <div
              key={s.id}
              className={`
                border-2 rounded-lg p-4 transition-all
                ${isActive 
                  ? `${s.bgColor} ${s.borderColor}` 
                  : 'bg-[#0a0a0a] border-gray-800'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`
                  p-3 rounded-lg 
                  ${isActive ? s.bgColor : 'bg-gray-900'}
                `}>
                  <Icon 
                    size={24} 
                    className={isActive ? s.iconColor : 'text-gray-600'}
                  />
                </div>
                <div className="flex-1">
                  <h3 className={`
                    font-medium
                    ${isActive ? 'text-white' : 'text-gray-500'}
                  `}>
                    {s.label}
                  </h3>
                  {isActive && (
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${s.iconColor.replace('text', 'bg')} animate-pulse`} />
                      <span className="text-xs text-gray-400">Active</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
