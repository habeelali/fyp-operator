'use client';

import { useState, useEffect, useCallback } from 'react';
import { Battery, Zap, CheckCircle, XCircle, Power, Play, StopCircle, RefreshCw } from 'lucide-react';

// Define the structure of the data received from the ESP32's /powerstats endpoint
interface Esp32PowerStats {
  state: 'OFF' | 'READY' | 'CRANKING' | 'RUNNING' | 'ERROR';
  ip: string;
  v24: number;
  v51: number;
  i51: number;
  v52: number;
  i52: number;
  v33: number;
  i33: number;
  iACS: number;
  power: number;
  R1_D4: boolean;
  R2_D16: boolean;
  R3_D17: boolean;
  R4_D5: boolean;
}

// Define the structure used by the component's UI state
interface PowerData {
  rail24v: number;
  rail5v1: number;
  rail5v2: number;
  rail3v3: number;
  packCurrent: number;
  current5v1: number;
  current5v2: number;
  current3v3: number;
  systemState: 'OFF' | 'READY' | 'CRANKING' | 'RUNNING' | 'ERROR';
}

const ESP32_IP = 'http://192.168.100.99'; // Base IP for the ESP32 web server

// Initial dummy state while loading
const initialData: PowerData = {
  rail24v: 0,
  rail5v1: 0,
  rail5v2: 0,
  rail3v3: 0,
  packCurrent: 0,
  current5v1: 0,
  current5v2: 0,
  current3v3: 0,
  systemState: 'OFF',
};

// Initial Relay State based on API output
interface RelayState {
  id: number;
  label: string;
  key: keyof Esp32PowerStats;
  enabled: boolean;
}

export default function PowerStats() {
  const [data, setData] = useState<PowerData>(initialData);
  const [relays, setRelays] = useState<RelayState[]>([
    { id: 1, label: 'Relay 1 (D4)', key: 'R1_D4', enabled: false },
    { id: 2, label: 'Relay 2 (D16)', key: 'R2_D16', enabled: false },
    { id: 3, label: 'Relay 3 (D17)', key: 'R3_D17', enabled: false },
    { id: 4, label: 'Relay 4 (D5)', key: 'R4_D5', enabled: false },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  // NEW STATE: Tracks when a relay change command is in flight
  const [isRelayChanging, setIsRelayChanging] = useState(false); 

  /**
   * Fetches power stats from the ESP32 and updates the component state.
   */
  const fetchPowerStats = useCallback(async () => {
    try {
      const response = await fetch(`${ESP32_IP}/powerstats`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const esp32Data: Esp32PowerStats = await response.json();

      // Map API data to component state
      setData({
        rail24v: esp32Data.v24,
        rail5v1: esp32Data.v51,
        rail5v2: esp32Data.v52,
        rail3v3: esp32Data.v33,
        packCurrent: esp32Data.iACS,
        current5v1: esp32Data.i51,
        current5v2: esp32Data.i52,
        current3v3: esp32Data.i33,
        systemState: esp32Data.state,
      });

      // Update Relay States based on API response
      setRelays(prev => 
        prev.map(relay => ({
          ...relay,
          enabled: esp32Data[relay.key] as boolean,
        }))
      );

      setIsLoading(false);
      // Ensure the relay changing state is false once the data is received.
      setIsRelayChanging(false); 

    } catch (error) {
      console.error("Failed to fetch power stats:", error);
      setIsLoading(false);
    }
  }, []);

  // Polling useEffect hook
  useEffect(() => {
    fetchPowerStats(); // Initial fetch
    // Only poll if a relay command isn't currently changing.
    // The relay command itself will trigger a fetch on success.
    const intervalId = setInterval(() => {
        if (!isRelayChanging) {
            fetchPowerStats();
        }
    }, 2000); 

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchPowerStats, isRelayChanging]);

  /**
   * Sends a command to set all relay states.
   * @param updatedRelays The new state of all four relays.
   */
  const sendRelayCommand = async (updatedRelays: RelayState[]) => {
    setIsRelayChanging(true); // START loading/disabling
    const params = updatedRelays.map(r => `r${r.id}=${r.enabled ? 1 : 0}`).join('&');
    const url = `${ESP32_IP}/setrelay?${params}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to set relays.');
      }
      
      // OPTIMISTIC UPDATE: Set the new state immediately for responsiveness
      setRelays(updatedRelays);
      
      console.log(`Relay command successful: ${params}`);

      // SUCCESS: Trigger a fetch to confirm the state from the hardware
      await fetchPowerStats(); 
      
    } catch (error) {
      console.error("Error setting relays:", error);
      
      // FAILURE: Stop loading and rely on the next poll/manual refresh to correct the UI
      setIsRelayChanging(false); 
      
    }
  };


  /**
   * Toggles a single relay and sends the command.
   */
  const toggleRelay = (id: number) => {
    // 1. Calculate the new state for all relays
    const updatedRelays = relays.map(relay => 
      relay.id === id 
        ? { ...relay, enabled: !relay.enabled }
        : relay
    );
    
    // 2. Send the command for the entire set
    sendRelayCommand(updatedRelays);
  };
  
  /**
   * System Control Handlers
   */
  const handleStart = async () => {
    try {
        const response = await fetch(`${ESP32_IP}/start`);
        if (!response.ok) throw new Error('Start command failed');
        console.log('System START command sent.');
        await fetchPowerStats(); // Fetch new state immediately
    } catch (error) {
        console.error("Error sending START command:", error);
    }
  };

  const handleStop = async () => {
    try {
        const response = await fetch(`${ESP32_IP}/stop`);
        if (!response.ok) throw new Error('Stop command failed');
        console.log('System STOP command sent.');
        await fetchPowerStats(); // Fetch new state immediately
    } catch (error) {
        console.error("Error sending STOP command:", error);
    }
  };

  const StatItem = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-800/50 last:border-b-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-base font-mono text-white">{value.toFixed(2)} {unit}</span>
    </div>
  );
  
  // Display a loading state if data is being fetched for the first time
  if (isLoading) {
    return (
        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 text-white text-center">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-gray-400" />
            Loading Power Stats from {ESP32_IP}...
        </div>
    );
  }

  // --- RENDERING ---
  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className='flex items-center space-x-2'>
            <Zap size={22} className="text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Power Management Dashboard</h2>
        </div>
        <button 
            onClick={fetchPowerStats}
            disabled={isRelayChanging} // Disable during relay change
            className={`p-2 rounded-full transition-colors ${isRelayChanging ? 'bg-gray-900 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700'}`}
            title="Manual Refresh"
        >
            <RefreshCw size={18} className='text-gray-400' />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Voltage Rails */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <Battery size={16} className="mr-2 text-blue-500" />
            Voltage Rails
          </h3>
          <div className="space-y-1">
            <StatItem label="24V Rail" value={data.rail24v} unit="V" />
            <StatItem label="5V Rail 1" value={data.rail5v1} unit="V" />
            <StatItem label="5V Rail 2" value={data.rail5v2} unit="V" />
            <StatItem label="3.3V Rail" value={data.rail3v3} unit="V" />
          </div>
        </div>

        {/* Current Draw */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            <Zap size={16} className="mr-2 text-yellow-500" />
            Current Draw
          </h3>
          <div className="space-y-1">
            <StatItem label="Pack Current" value={data.packCurrent} unit="A" />
            <StatItem label="5V1 Current" value={Math.abs(data.current5v1)} unit="A" />
            <StatItem label="5V2 Current" value={Math.abs(data.current5v2)} unit="A" />
            <StatItem label="3.3V Current" value={Math.abs(data.current3v3)} unit="A" />
          </div>
        </div>

        {/* System Status & Control */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">System Status & Control</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">System State</p>
              <div className="flex items-center space-x-2">
                <div className={`
                    w-3 h-3 rounded-full 
                    ${data.systemState === 'RUNNING' ? 'bg-green-500 animate-pulse' : 
                      data.systemState === 'READY' ? 'bg-yellow-500' :
                      data.systemState === 'ERROR' ? 'bg-red-500' : 'bg-gray-500'}
                `} />
                <span className="text-white font-medium">
                    {data.systemState}
                </span>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-400 mb-2">Total Power</p>
              <p className="text-2xl font-bold text-white">
                {(data.packCurrent * data.rail24v).toFixed(1)} W
              </p>
            </div>

            {/* System Control Buttons */}
            <div className="flex space-x-2 pt-2 border-t border-gray-800/50">
                <button
                    onClick={handleStart}
                    disabled={data.systemState !== 'READY' || isRelayChanging} // Disable if relay is changing
                    className={`flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium 
                        ${data.systemState === 'READY' && !isRelayChanging ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 opacity-50 cursor-not-allowed'}
                        text-white transition-colors`}
                >
                    <Play size={16} className="mr-1" /> START
                </button>
                <button
                    onClick={handleStop}
                    disabled={data.systemState === 'OFF' || isRelayChanging} // Disable if relay is changing
                    className={`flex-1 flex items-center justify-center p-2 rounded-lg text-sm font-medium 
                        ${data.systemState !== 'OFF' && !isRelayChanging ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 opacity-50 cursor-not-allowed'}
                        text-white transition-colors`}
                >
                    <StopCircle size={16} className="mr-1" /> STOP
                </button>
            </div>

          </div>
        </div>

        {/* Relay Controls */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
            {isRelayChanging ? (
                <>
                    <RefreshCw size={16} className="mr-2 text-purple-500 animate-spin" />
                    Updating...
                </>
            ) : (
                <>
                    <Power size={16} className="mr-2 text-purple-500" />
                    Relay Controls
                </>
            )}
          </h3>
          <div className="space-y-3">
            {relays.map((relay) => (
              <button
                key={relay.id}
                onClick={() => toggleRelay(relay.id)}
                // Disable if not RUNNING OR if a relay command is in flight
                disabled={data.systemState !== 'RUNNING' || isRelayChanging} 
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                  transition-all border
                  ${relay.enabled 
                    ? 'bg-green-900/30 border-green-600' 
                    : 'bg-gray-900 border-gray-700'
                  }
                  ${data.systemState !== 'RUNNING' || isRelayChanging ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}
                `}
              >
                <span className="text-sm font-medium text-white">{relay.label}</span>
                <div className="flex items-center space-x-2">
                  {/* Show a spinner on the button if it is the one being changed (optional refinement) */}
                  {isRelayChanging ? (
                    <RefreshCw size={14} className="animate-spin text-gray-400" />
                  ) : (
                    <>
                      <span className={`text-xs font-medium ${relay.enabled ? 'text-green-400' : 'text-gray-500'}`}>
                        {relay.enabled ? 'ON' : 'OFF'}
                      </span>
                      <div className={`
                        w-2 h-2 rounded-full
                        ${relay.enabled ? 'bg-green-500' : 'bg-gray-600'}
                      `} />
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}