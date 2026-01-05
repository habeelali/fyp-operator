'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Wifi, Network, Radio, LoaderCircle } from 'lucide-react';

// Define the data structure for our new API response
interface SystemHealth {
  lte: { status: 'online' | 'offline'; signal: number };
  mesh: { status: 'online' | 'offline'; nodes: number };
  telemetry: { status: 'online' | 'offline'; latency_ms: number | null };
}

const API_BASE_URL = 'http://localhost:8000';

// Initial state to show while loading
const initialHealth: SystemHealth = {
  lte: { status: 'offline', signal: 0 },
  mesh: { status: 'offline', nodes: 0 },
  telemetry: { status: 'offline', latency_ms: null },
};

export default function ConnectionStatus() {
  const [health, setHealth] = useState<SystemHealth>(initialHealth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await axios.get<SystemHealth>(`${API_BASE_URL}/api/system-health`);
        setHealth(response.data);
      } catch (error) {
        console.error("Failed to fetch system health:", error);
        // In case of error, we can reset to a disconnected state
        setHealth(initialHealth);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth(); // Initial fetch
    const interval = setInterval(fetchHealth, 3000); // Poll every 3 seconds

    return () => clearInterval(interval); // Cleanup timer
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-400">
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 flex items-center justify-center h-32"><LoaderCircle className="animate-spin mr-2"/>Loading...</div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 flex items-center justify-center h-32"><LoaderCircle className="animate-spin mr-2"/>Loading...</div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 flex items-center justify-center h-32"><LoaderCircle className="animate-spin mr-2"/>Loading...</div>
      </div>
    );
  }

  const isLteConnected = health.lte.status === 'online';
  const isMeshConnected = health.mesh.status === 'online';
  const isTelemetryConnected = health.telemetry.status === 'online';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* LTE Connection */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Wifi size={20} className={isLteConnected ? "text-blue-500" : "text-gray-600"} />
            <h3 className="font-medium text-white">LTE</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${isLteConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {isLteConnected ? 'Connected' : 'Disconnected'}
          </p>
          {isLteConnected && (
            <>
              <p className="text-sm text-gray-400 mt-2">Signal Strength</p>
              <p className="text-lg font-semibold text-white">{health.lte.signal}%</p>
            </>
          )}
        </div>
      </div>

      {/* Mesh Network */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Network size={20} className={isMeshConnected ? "text-purple-500" : "text-gray-600"} />
            <h3 className="font-medium text-white">Mesh Network</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${isMeshConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {isMeshConnected ? 'Active' : 'Inactive'}
          </p>
          {isMeshConnected && (
            <>
              <p className="text-sm text-gray-400 mt-2">Relay Nodes</p>
              <p className="text-lg font-semibold text-white">{health.mesh.nodes}</p>
            </>
          )}
        </div>
      </div>

      {/* Telemetry Link */}
      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Radio size={20} className={isTelemetryConnected ? "text-orange-500" : "text-gray-600"} />
            <h3 className="font-medium text-white">Telemetry Link</h3>
          </div>
          <div className={`w-2 h-2 rounded-full ${isTelemetryConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-400">Status</p>
          <p className="text-lg font-semibold text-white">
            {isTelemetryConnected ? 'Online' : 'Offline'}
          </p>
          {isTelemetryConnected && health.telemetry.latency_ms !== null && (
            <>
              <p className="text-sm text-gray-400 mt-2">Latency</p>
              <p className="text-lg font-semibold text-white">{health.telemetry.latency_ms}ms</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}