'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Navigation, Gamepad2, Pause, LoaderCircle } from 'lucide-react';

type UGVState = 'idling' | 'tele-op' | 'autonomous';

const API_BASE_URL = 'http://localhost:8000';

export default function SystemState() {
  const [currentState, setCurrentState] = useState<UGVState>('idling');
  const [isChanging, setIsChanging] = useState(false); // To show a loading state on click

  // 1. Fetch the current state from the backend periodically
  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await axios.get<{ state: UGVState }>(`${API_BASE_URL}/api/ugv-state`);
        setCurrentState(response.data.state);
      } catch (error) {
        console.error("Failed to fetch UGV state:", error);
        // Optional: handle error display
      }
    };

    fetchState(); // Fetch on load
    const interval = setInterval(fetchState, 2000); // Poll every 2 seconds

    return () => clearInterval(interval); // Cleanup timer
  }, []);

  // 2. Handle clicks to change the state
  const handleStateChange = async (newState: UGVState) => {
    if (newState === currentState || isChanging) return; // Don't do anything if already in that state or changing

    setIsChanging(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/ugv-state`, { state: newState });
      setCurrentState(response.data.new_state); // Update state from server's response
    } catch (error) {
      console.error(`Failed to set UGV state to ${newState}:`, error);
      // Optional: show a toast notification for the error
    } finally {
      setIsChanging(false);
    }
  };

  const states = [
    { id: 'idling' as UGVState, label: 'Idling', icon: Pause, bgColor: 'bg-gray-900', borderColor: 'border-gray-700', iconColor: 'text-gray-400' },
    { id: 'tele-op' as UGVState, label: 'Teleoperation', icon: Gamepad2, bgColor: 'bg-blue-900/30', borderColor: 'border-blue-600', iconColor: 'text-blue-500' },
    { id: 'autonomous' as UGVState, label: 'Autonomous', icon: Navigation, bgColor: 'bg-green-900/30', borderColor: 'border-green-600', iconColor: 'text-green-500' },
  ];

  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-white mb-4">Current State</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {states.map((s) => {
          const Icon = s.icon;
          const isActive = s.id === currentState;
          
          return (
            <button
              key={s.id}
              onClick={() => handleStateChange(s.id)}
              disabled={isChanging}
              className={`
                border-2 rounded-lg p-4 text-left transition-all duration-200
                ${isActive ? `${s.bgColor} ${s.borderColor}` : 'bg-[#0a0a0a] border-gray-800 hover:border-gray-600'}
                ${isChanging ? 'cursor-wait opacity-60' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-lg ${isActive ? s.bgColor : 'bg-gray-900'}`}>
                  {isChanging && isActive ? (
                    <LoaderCircle size={24} className="animate-spin text-gray-400" />
                  ) : (
                    <Icon size={24} className={isActive ? s.iconColor : 'text-gray-600'} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>
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
            </button>
          );
        })}
      </div>
    </div>
  );
}