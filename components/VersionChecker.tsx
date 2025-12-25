
import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../constants';
import Button from './Button';

const VersionChecker: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string>('');

  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Add a timestamp to the fetch URL to ensure we never get a cached version of version.json
        const response = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // If the server version differs from the hardcoded constant in the running app
          if (data.version && data.version !== APP_VERSION) {
            console.log(`Version mismatch! App: ${APP_VERSION}, Server: ${data.version}`);
            setNewVersion(data.version);
            setUpdateAvailable(true);
          }
        }
      } catch (error) {
        console.error("Failed to check version:", error);
      }
    };

    // Check immediately on mount
    checkVersion();

    // Optional: Check every 5 minutes while the tab is open
    const interval = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleReload = () => {
    // Force a reload by changing the search parameter.
    // This forces the browser to treat the page as a new resource request.
    const url = new URL(window.location.href);
    url.searchParams.set('v', newVersion || Date.now().toString());
    window.location.href = url.toString();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
      <div className="bg-yellow-400 border-[4px] border-black comic-shadow p-6 max-w-md w-full text-center relative">
        <div className="absolute -top-6 -right-6 text-6xl transform rotate-12">
            🚀
        </div>
        
        <h2 className="text-3xl font-comic-title text-black mb-2 transform -rotate-1">
          NEW VERSION!
        </h2>
        <div className="bg-black text-white p-2 font-mono text-sm mb-4 border-2 border-white">
          <p>DETECTED: v{newVersion}</p>
          <p>CURRENT: v{APP_VERSION}</p>
        </div>
        
        <p className="font-bold text-black mb-6 text-lg">
          An update has been deployed. Reload to get the latest features and bug fixes!
        </p>
        
        <Button onClick={handleReload} className="w-full animate-pulse shadow-[4px_4px_0_white]">
          TAP TO RELOAD
        </Button>
      </div>
    </div>
  );
};

export default VersionChecker;
