'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// 1. Define the shape of our settings
interface AppSettings {
  apiBaseUrl: string;
  rosBridgeUrl: string;
}

// 2. Define the context, including a function to update settings
interface SettingsContextType {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
}

// 3. Provide default values
const defaultSettings: AppSettings = {
  apiBaseUrl: 'http://localhost:8000',
  rosBridgeUrl: 'ws://192.168.100.100:9090',
};

// 4. Create the actual React Context
const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  setSettings: () => {},
});

// 5. Create a "Provider" component that will wrap our entire application
export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);

  // On initial load, try to get settings from localStorage
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem('ugv-operator-settings');
      if (storedSettings) {
        setSettingsState(JSON.parse(storedSettings));
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
  }, []);

  // Function to update both state and localStorage
  const handleSetSettings = (newSettings: AppSettings) => {
    try {
      localStorage.setItem('ugv-operator-settings', JSON.stringify(newSettings));
      setSettingsState(newSettings);
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings: handleSetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

// 6. Create a custom "hook" to easily access the settings from any component
export const useSettings = () => useContext(SettingsContext);