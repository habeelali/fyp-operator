'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Home, 
  Map, 
  Camera, 
  Radio, 
  Settings, 
  Activity,
  ChevronLeft,
  ChevronRight 
} from 'lucide-react';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { icon: Home, label: 'Overview', href: '/' },
    { icon: Map, label: 'Navigation', href: '/navigation' },
    { icon: Camera, label: 'Camera Feed', href: '/camera' },
    { icon: Activity, label: 'Telemetry', href: '/telemetry' },
    { icon: Radio, label: 'Network', href: '/network' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <aside 
      className={`bg-[#0f0f0f] border-r border-gray-800 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo/Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">UGV</span>
            </div>
            <span className="font-semibold text-white">Operator</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 hover:bg-gray-800 rounded transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center px-4 py-3 hover:bg-gray-800/50 transition-colors group"
          >
            <item.icon 
              size={20} 
              className="text-gray-400 group-hover:text-blue-500 transition-colors" 
            />
            {!collapsed && (
              <span className="ml-3 text-sm text-gray-300 group-hover:text-white transition-colors">
                {item.label}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        {!collapsed && (
          <div className="text-xs text-gray-500">
            <p>UGV Control v1.0</p>
            <p className="mt-1">FYP 2025</p>
          </div>
        )}
      </div>
    </aside>
  );
}
