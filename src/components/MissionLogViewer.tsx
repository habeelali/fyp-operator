"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { useSettings } from "@/contexts/SettingsContext"; // Added import for useSettings
import { LoaderCircle, AlertTriangle, Inbox } from "lucide-react";

// Define the data structures for our API responses
interface Mission {
  mission_id: string;
  directory_name: string;
  created_at: string;
  entry_count: number;
}

interface MissionLogEntry {
  entry_id: string;
  timestamp: string;
  location: string;
  detections: string;
  severity: "LOW" | "MEDIUM" | "CRITICAL" | "SAFE" | "UNCERTAIN";
  image_path: string;
}

export default function MissionLogViewer() {
  const { settings } = useSettings(); // Added to get settings from context
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<string>("");
  const [logEntries, setLogEntries] = useState<MissionLogEntry[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch the list of all missions when the component first loads
  useEffect(() => {
    const fetchMissions = async () => {
      try {
        setLoadingMissions(true);
        // Updated to use dynamic API URL from settings
        const response = await axios.get<{ missions: Mission[] }>(
          `${settings.apiBaseUrl}/api/missions`
        );
        setMissions(response.data.missions);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch missions:", err);
        setError("Could not connect to the Vision API to fetch missions.");
      } finally {
        setLoadingMissions(false);
      }
    };
    fetchMissions();
  }, [settings.apiBaseUrl]); // Added dependency on settings.apiBaseUrl

  // 2. Fetch logs for a specific mission whenever 'selectedMission' changes
  useEffect(() => {
    if (!selectedMission) {
      setLogEntries([]);
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        // Updated to use dynamic API URL from settings
        const response = await axios.get<{ entries: MissionLogEntry[] }>(
          `${settings.apiBaseUrl}/api/missions/${selectedMission}/logs`
        );
        setLogEntries(response.data.entries);
        setError(null);
      } catch (err) {
        console.error(`Failed to fetch logs for ${selectedMission}:`, err);
        setError(`Failed to load logs for mission ${selectedMission}.`);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [selectedMission, settings.apiBaseUrl]); // Added dependency on settings.apiBaseUrl

  const getSeverityClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-500 text-white";
      case "MEDIUM":
        return "bg-yellow-500 text-black";
      case "LOW":
        return "bg-blue-500 text-white";
      case "SAFE":
        return "bg-green-500 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Mission Log Viewer</h2>
        <select
          value={selectedMission}
          onChange={(e) => setSelectedMission(e.target.value)}
          className="bg-[#0a0a0a] border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={loadingMissions || missions.length === 0}
        >
          <option value="">-- Select a Mission --</option>
          {missions.map((mission) => (
            <option key={mission.directory_name} value={mission.directory_name}>
              Mission {mission.created_at} ({mission.entry_count} entries)
            </option>
          ))}
        </select>
      </div>

      {loadingMissions && (
        <div className="flex items-center justify-center p-8 text-gray-400">
          <LoaderCircle className="animate-spin mr-2" />
          Loading available missions...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center p-8 text-red-500">
          <AlertTriangle className="mr-2" />
          {error}
        </div>
      )}

      {!loadingMissions && !error && (
        <div className="overflow-x-auto">
          {loadingLogs ? (
            <div className="flex items-center justify-center p-8 text-gray-400">
              <LoaderCircle className="animate-spin mr-2" />
              Loading mission logs...
            </div>
          ) : logEntries.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Detections
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Image
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {logEntries.map((entry) => (
                  <tr key={entry.entry_id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400 font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                      {entry.location}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                      {entry.detections || "None"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getSeverityClass(
                          entry.severity
                        )}`}
                      >
                        {entry.severity || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-400 hover:underline">
                      {/* Updated href to use dynamic API URL from settings */}
                      <a
                        href={`${settings.apiBaseUrl}/api/mission_data/${entry.image_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Image
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <Inbox size={32} className="mb-2" />
              {selectedMission
                ? "This mission has no log entries."
                : "Select a mission to view logs."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
