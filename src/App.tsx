/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [showClock, setShowClock] = useState(false); 
  
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerRef = useRef<number | null>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.error('Wake lock release error:', err);
      }
      wakeLockRef.current = null;
    }
  }, []);

  const handlePowerOff = useCallback(() => {
    setShowClock(false);
    releaseWakeLock();
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [releaseWakeLock]);

  const startTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      handlePowerOff();
    }, 5000); // Precise 5 seconds
  }, [handlePowerOff]);

  const handlePowerOn = async () => {
    if (showClock) {
      startTimer(); // Reset timer if already visible
      return;
    }

    setShowClock(true);
    
    // Request Wake Lock immediately on user gesture
    if ('wakeLock' in navigator) {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
      } catch (err) {
        console.warn('Wake lock request failed:', err);
      }
    }

    // Request Fullscreen on user gesture
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    startTimer();
  };

  // Handle visibility change (e.g. screen off button pressed)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handlePowerOff();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handlePowerOff]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black flex items-center justify-center cursor-none select-none overflow-hidden"
      onClick={handlePowerOn}
    >
      <AnimatePresence mode="wait">
        {showClock && (
          <motion.div 
            key="clock-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center text-center"
          >
            <h1 className="text-[35vw] font-thin tracking-tighter leading-none font-sans text-white">
              {formatTime(time)}
            </h1>
            <div className="mt-6 text-[11px] font-mono tracking-[0.4em] uppercase opacity-20 text-white">
              {formatDate(time)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift {
          from { transform: translate(-2px, -2px); }
          to { transform: translate(2px, 2px); }
        }
        h1 {
          animation: drift 10s infinite alternate ease-in-out;
        }
      `}} />
    </div>
  );
}
