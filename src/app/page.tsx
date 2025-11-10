'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import ConnectionStatus from '@/components/ConnectionStatus';
import PowerStats from '@/components/PowerStats';
import SystemState from '@/components/SystemState';

export default function Home() {
  // Mock data - replace with actual WebSocket/API data
  const [connectionData, setConnectionData] = useState({
    lte: { connected: true, signal: 85 },
    mesh: { connected: true, nodes: 3 },
    telemetry: { connected: true, latency: 45 }
  });

  const [powerData, setPowerData] = useState({
    rail24v: 24.2,
    rail5v1: 5.05,
    rail5v2: 4.98,
    rail3v3: 3.31,
    packCurrent: 3.2,
    current5v1: 1.5,
    current5v2: 0.8,
    current3v3: 0.4,
    postStatus: 'success',
    systemStatus: 'running'
  });

  const [ugvState, setUgvState] = useState<'idling' | 'tele-op' | 'autonomous'>('idling');

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="border-b border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            {/* <p className="text-gray-400 mt-1">Real-time system monitoring and status</p> */}
          </div>

          {/* Connection Status */}
          <ConnectionStatus data={connectionData} />

          {/* Power Statistics */}
          <PowerStats data={powerData} />

          {/* System State */}
          <SystemState state={ugvState} />
        </div>
      </main>
    </div>
  );
}
