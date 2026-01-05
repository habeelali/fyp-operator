'use client';

import Sidebar from '@/components/Sidebar';
import { useState, useEffect, useRef } from 'react';
import * as ROSLIB from 'roslib';
import { useSettings } from '@/contexts/SettingsContext'; // 1. Import the hook
import { LoaderCircle, Video, XCircle } from 'lucide-react';

// The topic that publishes the compressed camera feed
const CAMERA_TOPIC = '/camera/image_raw/compressed';

export default function CameraPage() {
  const { settings } = useSettings(); // 2. Get settings from the context
  
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  
  // useRef is used to hold the ROS connection object so it doesn't get recreated on every render
  const ros = useRef<ROSLIB.Ros | null>(null);
  const cameraListener = useRef<ROSLIB.Topic | null>(null);

  useEffect(() => {
    // --- 1. ESTABLISH ROS CONNECTION ---
    // 3. Use the dynamic URL from settings
    ros.current = new ROSLIB.Ros({
      url: settings.rosBridgeUrl,
    });

    ros.current.on('connection', () => {
      console.log('Connected to ROS WebSocket server.');
      setConnectionStatus('connected');
      subscribeToCamera();
    });

    ros.current.on('error', (error) => {
      console.error('Error connecting to ROS WebSocket server: ', error);
      setConnectionStatus('error');
    });

    ros.current.on('close', () => {
      console.log('Connection to ROS WebSocket server closed.');
      setConnectionStatus('connecting'); // Try to reconnect
    });

    // --- 2. SUBSCRIBE TO CAMERA TOPIC ---
    const subscribeToCamera = () => {
      if (!ros.current) return;

      cameraListener.current = new ROSLIB.Topic({
        ros: ros.current,
        name: CAMERA_TOPIC,
        messageType: 'sensor_msgs/CompressedImage'
      });

      // --- 3. HANDLE INCOMING IMAGE MESSAGES ---
      cameraListener.current.subscribe((message: any) => {
        // ROS compressed images are sent as a base64 encoded string in the 'data' field.
        // We can display this directly in an <img> tag by creating a data URL.
        const frameData = `data:image/jpeg;base64,${message.data}`;
        setLatestFrame(frameData);
      });
    };

    // --- 4. CLEANUP ON UNMOUNT ---
    return () => {
      if (cameraListener.current) {
        cameraListener.current.unsubscribe();
      }
      if (ros.current && ros.current.isConnected) {
        ros.current.close();
      }
    };
  }, [settings.rosBridgeUrl]); // 4. Add dependency to reconnect if URL changes

  // Helper to render the current status overlay on the video feed
  const renderStatusOverlay = () => {
    if (connectionStatus === 'connected' && latestFrame) return null;

    let statusContent;
    if (connectionStatus === 'connecting') {
      statusContent = <><LoaderCircle className="animate-spin mr-2" /> Connecting to UGV camera...</>;
    } else if (connectionStatus === 'error') {
      statusContent = <><XCircle className="mr-2" /> Connection Error. Is the UGV online?</>;
    } else {
      statusContent = <><Video className="mr-2" /> Waiting for video stream...</>;
    }
    
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            {statusContent}
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="border-b border-gray-800 pb-4">
            <h1 className="text-3xl font-bold text-white">Camera Feed</h1>
          </div>
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
            <h2 className="text-lg text-white font-semibold mb-2">Live Stream</h2>
            <div className="aspect-video bg-black rounded overflow-hidden relative">
              {latestFrame && (
                <img
                  src={latestFrame}
                  alt="Live UGV Camera Feed"
                  className="w-full h-full object-contain"
                />
              )}
              {renderStatusOverlay()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}