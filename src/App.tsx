/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(false);
  
  const wakeLockRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) {}
      wakeLockRef.current = null;
    }
  }, []);

  const turnOff = useCallback(() => {
    setIsVisible(false);
    releaseWakeLock();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [releaseWakeLock]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      turnOff();
    }, 5000);
  }, [turnOff]);

  const handleInteraction = () => {
    // Refresh time immediately
    setTime(new Date());

    if (isVisible) {
      startTimer(); // Reset timer
      return;
    }

    setIsVisible(true);

    // Request Wake Lock - handle policy restrictions gracefully
    if ('wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock.request('screen')
          .then((lock: any) => {
            wakeLockRef.current = lock;
            lock.addEventListener('release', () => {
              if (wakeLockRef.current === lock) {
                wakeLockRef.current = null;
              }
            });
          })
          .catch((err: any) => {
            // This catches "NotAllowedError" or "SecurityError" from the promise
            console.warn('Wake Lock blocked by policy or user:', err.message);
          });
      } catch (err: any) {
        // Catch synchronous errors
        console.warn('Wake Lock synchronous error:', err.message);
      }
    }

    startTimer();
  };

  // Safety: Turn off if app goes to background
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        turnOff();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [turnOff]);

  const formatTime = (date: Date) => {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
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
      className="fixed inset-0 bg-black flex items-center justify-center cursor-pointer select-none overflow-hidden"
      onClick={handleInteraction}
      style={{ touchAction: 'manipulation' }}
    >
      {isVisible && (
        <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
          <div className="text-[35vw] font-thin tracking-tighter leading-none text-white font-sans">
            {formatTime(time)}
          </div>
          <div className="mt-6 text-[11px] font-mono tracking-[0.4em] uppercase text-white/20">
            {formatDate(time)}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes drift {
          from { transform: translate(-1px, -1px); }
          to { transform: translate(1px, 1px); }
        }
        .animate-in {
          animation: drift 10s infinite alternate ease-in-out;
        }
      `}} />
    </div>
  );
}
