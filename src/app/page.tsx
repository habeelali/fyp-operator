'use client';

// NOTE: We no longer need useState here for connectionData

import Sidebar from '@/components/Sidebar';
import ConnectionStatus from '@/components/ConnectionStatus';
import PowerStats from '@/components/PowerStats';
import SystemState from '@/components/SystemState';
import MissionLogViewer from '@/components/MissionLogViewer';

export default function Home() {

  // The Home component is now extremely simple!
  // All components now manage their own data.

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-white">Overview</h1>
          </div>

          {/* All components now fetch their own data. No props needed! */}
          <ConnectionStatus />
          <PowerStats />
          <SystemState />
          <MissionLogViewer />

        </div>
      </main>
    </div>
  );
}