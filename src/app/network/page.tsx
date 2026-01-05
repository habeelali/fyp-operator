"use client";

import Sidebar from "@/components/Sidebar";
import {
  Wifi,
  Rss,
  Network,
  ServerCrash,
  BarChartHorizontal,
} from "lucide-react";

// Reusable component for a network interface card
const NetworkCard = ({
  name,
  status,
  details,
  icon: Icon,
  color,
}: {
  name: string;
  status: "Connected" | "Degraded" | "Disconnected";
  details: React.ReactNode;
  icon: React.ElementType;
  color: string;
}) => {
  const statusColor =
    status === "Connected"
      ? "bg-green-500"
      : status === "Degraded"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Icon size={20} className={color} />
          <h3 className="font-medium text-white">{name}</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-gray-300">{status}</span>
        </div>
      </div>
      <div className="space-y-2 text-sm text-gray-400 border-t border-gray-800 pt-3 mt-3">
        {details}
      </div>
    </div>
  );
};

export default function NetworkPage() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="border-b border-gray-800 pb-4 mb-6">
            <h1 className="text-3xl font-bold text-white">
              Network Diagnostics
            </h1>
            <p className="text-gray-400 mt-1">
              Monitor and manage all UGV communication links.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NetworkCard
              name="Primary WiFi Link"
              status="Connected"
              icon={Wifi}
              color="text-blue-500"
              details={
                <>
                  <p className="flex justify-between">
                    <span>IP Address:</span>{" "}
                    <span className="font-mono">192.168.100.101</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Signal (RSSI):</span>{" "}
                    <span className="font-mono">-45 dBm</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Bandwidth:</span>{" "}
                    <span className="font-mono">54 Mbps</span>
                  </p>
                </>
              }
            />
            <NetworkCard
              name="LTE Backup Link"
              status="Degraded"
              icon={Rss}
              color="text-yellow-500"
              details={
                <>
                  <p className="flex justify-between">
                    <span>Provider:</span>{" "}
                    <span className="font-mono">T-Mobile</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Signal (RSRP):</span>{" "}
                    <span className="font-mono">-102 dBm</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Ping:</span> <span className="font-mono">88 ms</span>
                  </p>
                </>
              }
            />
            <NetworkCard
              name="ESP-NOW Mesh"
              status="Connected"
              icon={Network}
              color="text-purple-500"
              details={
                <>
                  <p className="flex justify-between">
                    <span>Active Nodes:</span>{" "}
                    <span className="font-mono">3</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Hops to UGV:</span>{" "}
                    <span className="font-mono">2</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Last Message:</span>{" "}
                    <span className="font-mono">2s ago</span>
                  </p>
                </>
              }
            />
            <NetworkCard
              name="LoRa Radio Telemetry"
              status="Disconnected"
              icon={ServerCrash}
              color="text-red-500"
              details={
                <>
                  <p className="flex justify-between">
                    <span>Frequency:</span>{" "}
                    <span className="font-mono">915 MHz</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Status:</span>{" "}
                    <span className="font-mono text-red-400">No Signal</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Last Heartbeat:</span>{" "}
                    <span className="font-mono">3 minutes ago</span>
                  </p>
                </>
              }
            />
          </div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <BarChartHorizontal size={20} className="mr-2" />
              Network Priority & Failover
            </h2>
            <p className="text-center text-gray-500 py-8">
              A diagram or log showing the network failover logic will be
              implemented here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
