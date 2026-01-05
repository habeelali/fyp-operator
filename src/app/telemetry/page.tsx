'use client';

import Sidebar from '@/components/Sidebar';
import { LineChart, BarChart, Rss, Thermometer } from 'lucide-react';

// A reusable component for a single telemetry card
const TelemetryCard = ({ title, value, unit, icon: Icon }: { title: string, value: string, unit: string, icon: React.ElementType }) => (
    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center text-gray-400 mb-2">
            <Icon size={18} className="mr-2" />
            <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div>
            <span className="text-2xl font-bold text-white">{value}</span>
            <span className="text-sm text-gray-500 ml-1">{unit}</span>
        </div>
    </div>
);


export default function TelemetryPage() {
    // We will replace this with live data from ROS2 later
    const mockTelemetry = {
        speed: '0.00',
        orientation: '0.0',
        signalStrength: '-55',
        temperature: '25.5'
    };

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
            <Sidebar />
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="border-b border-gray-800 pb-4 mb-6">
                        <h1 className="text-3xl font-bold text-white">Live Telemetry</h1>
                        <p className="text-gray-400 mt-1">Real-time sensor data and diagnostics from the UGV.</p>
                    </div>

                    {/* Key Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <TelemetryCard title="Speed" value={mockTelemetry.speed} unit="m/s" icon={LineChart} />
                        <TelemetryCard title="Orientation (Yaw)" value={mockTelemetry.orientation} unit="deg" icon={BarChart} />
                        <TelemetryCard title="Radio Signal (RSSI)" value={mockTelemetry.signalStrength} unit="dBm" icon={Rss} />
                        <TelemetryCard title="Core Temperature" value={mockTelemetry.temperature} unit="°C" icon={Thermometer} />
                    </div>

                    {/* Placeholder for future charts */}
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold text-white mb-4">Data Charts</h2>
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            Live data charts (e.g., IMU, Odometry) will be implemented here.
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}