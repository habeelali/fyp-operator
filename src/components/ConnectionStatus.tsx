'use client';

import { Wifi, Network, Radio } from 'lucide-react';

interface ConnectionData {
  lte: { connected: boolean; signal: number };
  mesh: { connected: boolean; nodes: number };
  telemetry: { connected: boolean; latency: number };
}

export default function ConnectionStatus({ data }: { data: ConnectionData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* LTE Connection */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Wifi size={20} className="text-blue-500" />
            <h3 className="font-medium text-white">LTE</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${data.lte.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {data.lte.connected ? 'Connected' : 'Disconnected'}
          </p>
          {data.lte.connected && (
            <>
              <p className="text-sm text-gray-400 mt-2">Signal Strength</p>
              <p className="text-lg font-semibold text-white">{data.lte.signal}%</p>
            </>
          )}
        </div>
      </div>

      {/* Mesh Network */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Network size={20} className="text-purple-500" />
            <h3 className="font-medium text-white">Mesh Network</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${data.mesh.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {data.mesh.connected ? 'Active' : 'Inactive'}
          </p>
          {data.mesh.connected && (
            <>
              <p className="text-sm text-gray-400 mt-2">Relay Nodes</p>
              <p className="text-lg font-semibold text-white">{data.mesh.nodes}</p>
            </>
          )}
        </div>
      </div>

      {/* Telemetry Link (NRF24) */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Radio size={20} className="text-orange-500" />
            <h3 className="font-medium text-white">Telemetry Link</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${data.telemetry.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {data.telemetry.connected ? 'Online' : 'Offline'}
          </p>
          {data.telemetry.connected && (
            <>
              <p className="text-sm text-gray-400 mt-2">Latency</p>
              <p className="text-lg font-semibold text-white">{data.telemetry.latency}ms</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
