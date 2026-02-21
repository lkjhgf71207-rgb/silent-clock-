/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Power } from 'lucide-react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [isDimmed, setIsDimmed] = useState(false);
  const [isPersistent, setIsPersistent] = useState(true);
  const [isOff, setIsOff] = useState(true); // Start "off" to force a user gesture to "power on"
  const [hasError, setHasError] = useState<string | null>(null);
  
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Wake Lock API with Persistence Logic
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock not supported');
      return;
    }

    if (isOff) return;

    try {
      // Release existing lock if any
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
      }

      const lock = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = lock;
      setHasError(null);
      
      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
        // If persistent and not manually turned off, try to re-acquire
        if (isPersistent && !isOff && document.visibilityState === 'visible') {
          // Re-requesting after a release might still need a gesture in some browsers,
          // but usually once granted it can be re-acquired on visibility change.
          requestWakeLock();
        }
      });
    } catch (err: any) {
      console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
      // Don't show error to user in AOD mode, just log it
      if (err.name === 'NotAllowedError') {
        setHasError('Wake Lock permission denied. Please ensure the app is not in an iframe or has proper permissions.');
      }
    }
  }, [isPersistent, isOff]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.error('Error releasing wake lock', err);
      }
      wakeLockRef.current = null;
    }
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPersistent && !isOff) {
        // Re-request wake lock on visibility change if we are in "AOD" mode
        if ('wakeLock' in navigator) {
          (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
            wakeLockRef.current = lock;
          }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPersistent, isOff]);

  // Handle cleanup
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const handlePowerOff = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsOff(true);
    setIsPersistent(false);
    releaseWakeLock();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handlePowerOn = () => {
    setIsOff(false);
    setIsPersistent(true);
    
    // 1. Immediate Wake Lock Request (Must be in the same tick as user gesture for maximum compatibility)
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((lock: WakeLockSentinel) => {
        wakeLockRef.current = lock;
        lock.addEventListener('release', () => {
          wakeLockRef.current = null;
          // Re-acquire only if still persistent and visible
          if (document.visibilityState === 'visible') {
            // This re-acquisition doesn't strictly need a gesture in most browsers once granted
            requestWakeLock();
          }
        });
      }).catch((err: any) => {
        console.warn('Initial wake lock failed:', err.message);
      });
    }

    // 2. Immediate Fullscreen Request
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      try {
        const fsPromise = document.documentElement.requestFullscreen();
        if (fsPromise instanceof Promise) {
          fsPromise.catch((err) => console.warn('Fullscreen rejected:', err.message));
        }
      } catch (err: any) {
        console.warn('Fullscreen sync error:', err.message);
      }
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    if (!isOff) setIsDimmed(!isDimmed);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isOff) {
    return (
      <div 
        className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 cursor-pointer"
        onClick={handlePowerOn}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center">
            <Power className="w-6 h-6 text-white/20" />
          </div>
          <div className="text-white/20 text-[10px] font-mono uppercase tracking-[0.4em]">Tap to Activate AOD</div>
          {hasError && (
            <div className="max-w-xs text-center text-red-500/40 text-[8px] font-mono uppercase mt-4 px-4">
              {hasError}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center transition-colors duration-1000 cursor-none select-none ${isDimmed ? 'bg-black' : 'bg-[#050505]'}`}
      onClick={handleTap}
      onDoubleClick={handlePowerOff}
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: isDimmed ? 0.05 : 0.85 }}
        transition={{ duration: 1.5 }}
        className="flex flex-col items-center text-center"
      >
        <h1 className="text-[32vw] font-thin tracking-tighter leading-none font-sans text-white">
          {formatTime(time)}
        </h1>
        <div className="mt-8 text-[10px] font-mono tracking-[0.5em] uppercase opacity-20 text-white">
          {formatDate(time)}
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift {
          0% { transform: translate(0, 0); }
          25% { transform: translate(4px, 4px); }
          50% { transform: translate(-4px, 3px); }
          75% { transform: translate(3px, -4px); }
          100% { transform: translate(0, 0); }
        }
        h1 {
          animation: drift 180s infinite linear;
        }
      `}} />
    </div>
  );
}
