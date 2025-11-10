'use client';

import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';

const CAMERA_URL = "http://localhost:5000/video_feed";

type DetectionAlert = {
  snapshot: string;
};

export default function CameraPage() {
  const [error, setError] = useState(false);
  const [alerts, setAlerts] = useState<DetectionAlert[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:5000/detections');

    eventSource.onmessage = (event) => {
      try {
        const data: DetectionAlert = JSON.parse(event.data);
        setAlerts(prev => [data, ...prev]); // Add new alerts to the start
      } catch (e) {
        console.error('Invalid detection alert data', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 flex">
        <div className="max-w-7xl mx-auto space-y-6 flex-1">
          <div className="border-b border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-white">Camera Feed</h1>
          </div>
          <div className="flex justify-center">
            <div className="bg-[#1a1a1a] rounded-lg shadow-lg p-4 border border-gray-800 w-full max-w-2xl">
              <h2 className="text-lg text-white font-semibold mb-2">Live Stream</h2>
              <div className="aspect-video bg-black rounded overflow-hidden flex items-center justify-center">
                {error ? (
                  <p className="text-red-500 text-center">Failed to load camera feed.</p>
                ) : (
                  <img
                    src={CAMERA_URL}
                    alt="Camera Feed"
                    className="w-full h-full object-contain"
                    onError={() => setError(true)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Multiple Alert Snapshots Pane */}
        {alerts.length > 0 && (
          <div className="w-96 ml-6 bg-[#1a1a1a] rounded-lg shadow-lg p-4 border border-gray-800 overflow-y-auto max-h-full">
            <h2 className="text-lg font-semibold text-white mb-2">Alert Snapshots</h2>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-96">
              {alerts.map((alert, index) => (
                <img
                  key={index}
                  src={alert.snapshot}
                  alt={`Alert Snapshot ${index + 1}`}
                  className="w-full rounded"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
