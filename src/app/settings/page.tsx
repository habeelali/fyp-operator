'use client';

import Sidebar from '@/components/Sidebar';
import { useSettings } from '@/contexts/SettingsContext';
import { useState, useEffect } from 'react'; // We need to import useEffect here

export default function SettingsPage() {
  const { settings, setSettings } = useSettings();
  
  // Local state to manage the form inputs
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [rosBridgeUrl, setRosBridgeUrl] = useState(settings.rosBridgeUrl);
  const [saveMessage, setSaveMessage] = useState('');

  // ====================================================================
  // THE FIX IS HERE!
  // ====================================================================
  // This effect runs whenever the global 'settings' object from the context changes.
  // This syncs our local form state with the global state after it's loaded from localStorage.
  useEffect(() => {
    setApiBaseUrl(settings.apiBaseUrl);
    setRosBridgeUrl(settings.rosBridgeUrl);
  }, [settings]); // The dependency array [settings] is the key! It tells React to re-run this code when 'settings' changes.
  // ====================================================================

  const handleSave = () => {
    setSettings({ apiBaseUrl, rosBridgeUrl });
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="border-b border-gray-800 pb-4 mb-6">
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-gray-400 mt-1">Configure application endpoints and preferences.</p>
          </div>

          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 space-y-6">
              <div>
                  <label htmlFor="api-url" className="block text-sm font-medium text-gray-300">
                      Vision API Base URL
                  </label>
                  <div className="mt-1">
                      <input
                          type="text"
                          id="api-url"
                          value={apiBaseUrl}
                          onChange={(e) => setApiBaseUrl(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="e.g., http://localhost:8000"
                      />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">The base URL for the Python FastAPI backend.</p>
              </div>

              <div>
                  <label htmlFor="ros-url" className="block text-sm font-medium text-gray-300">
                      ROS2 WebSocket URL
                  </label>
                  <div className="mt-1">
                      <input
                          type="text"
                          id="ros-url"
                          value={rosBridgeUrl}
                          onChange={(e) => setRosBridgeUrl(e.target.value)}
                          className="w-full bg-[#0a0a0a] border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="e.g., ws://192.168.100.100:9090"
                      />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">The WebSocket address for the ros2-web-bridge.</p>
              </div>

              <div className="flex items-center justify-end">
                  {saveMessage && <p className="text-sm text-green-400 mr-4">{saveMessage}</p>}
                  <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
                  >
                      Save Settings
                  </button>
              </div>
          </div>
        </div>
      </main>
    </div>
  );
}