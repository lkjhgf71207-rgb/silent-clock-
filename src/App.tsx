/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, ShieldCheck, AlertCircle, X, Smartphone, Battery, Lock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState<'unknown' | 'granted' | 'denied' | 'fallback'>('unknown');
  
  const wakeLockRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load();
      videoRef.current = null;
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

  const requestWakeLock = useCallback(async () => {
    // 1. Try Official Wake Lock API with robust error handling
    if ('wakeLock' in navigator) {
      try {
        // Always release existing lock before requesting a new one to prevent leaks/ANR
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }

        const lock = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockStatus('granted');
        
        lock.addEventListener('release', () => {
          if (wakeLockRef.current === lock) {
            wakeLockRef.current = null;
          }
        });
        return true;
      } catch (err: any) {
        // Catch and log, but don't crash
        console.error('Wake Lock failed:', err.name, err.message);
        setWakeLockStatus('denied');
      }
    }

    // 2. Fallback: Hidden Video Loop (Compatibility Mode)
    // This is the "backway" for environments with strict policies
    try {
      if (!videoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('loop', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.style.display = 'none';
        // Tiny 1x1 blank mp4 base64
        video.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAAACHZyZWQAAAAIdm9pZAAAAAh0cmFmAAAACHRyZWsAAAAIZm9ybQAAAAhkYXRh';
        videoRef.current = video;
      }
      
      // Use a promise to handle play() to avoid blocking the UI thread
      videoRef.current.play().catch(e => console.warn('Video fallback failed:', e));
      setWakeLockStatus('fallback');
      return true;
    } catch (err: any) {
      console.error('All wake methods failed:', err.message);
      setWakeLockStatus('denied');
      return false;
    }
  }, []);

  const handleInteraction = () => {
    if (showSetup) return;
    
    // Immediate UI feedback
    setTime(new Date());

    if (isVisible) {
      // If already visible, just reset the 5s timer
      startTimer();
      return;
    }

    // First tap: Show clock and request lock
    setIsVisible(true);
    
    // Fire and forget the wake lock request to keep UI responsive
    requestWakeLock();
    
    startTimer();
  };

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
      {/* Subtle Setup Trigger */}
      {!isVisible && !showSetup && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowSetup(true); }}
          className="absolute bottom-8 right-8 p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4 text-white/20" />
        </button>
      )}

      {/* Clock View */}
      {isVisible && !showSetup && (
        <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
          <div className="text-[35vw] font-thin tracking-tighter leading-none text-white font-sans">
            {formatTime(time)}
          </div>
          <div className="mt-6 text-[11px] font-mono tracking-[0.4em] uppercase text-white/20">
            {formatDate(time)}
          </div>
        </div>
      )}

      {/* Official System Permissions Dashboard */}
      <AnimatePresence>
        {showSetup && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-50 bg-[#0A0A0A] flex flex-col cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0F0F0F]">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-medium text-white">System Permissions</h2>
              </div>
              <button 
                onClick={() => setShowSetup(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-24">
              
              {/* The "Official Backway" (PWA Fix) Section */}
              <section className="space-y-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold px-1 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  Official Backway (Recommended)
                </div>
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">Bypass Browser Policy Restrictions</div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your browser blocks hardware access inside this preview frame. To grant <span className="text-white font-medium">Official System Permissions</span>:
                    </p>
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3 text-xs text-white bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-[10px]">1</div>
                      <span>Tap Browser Menu <span className="text-emerald-500 font-bold">(⋮)</span></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-[10px]">2</div>
                      <span>Select <span className="text-emerald-500 font-bold">"Install App"</span></span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Official Status Section */}
              <section className="space-y-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold px-1">Current Permission Status</div>
                <div className="bg-[#141414] rounded-2xl border border-white/5 divide-y divide-white/5">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${wakeLockStatus === 'granted' ? 'bg-emerald-500/10 text-emerald-500' : wakeLockStatus === 'fallback' ? 'bg-amber-500/10 text-amber-500' : 'bg-zinc-800 text-zinc-500'}`}>
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">Screen Wake Lock</div>
                        <div className="text-xs text-zinc-500">
                          {wakeLockStatus === 'granted' ? 'Officially Granted' : 
                           wakeLockStatus === 'fallback' ? 'Compatibility Mode (Active)' : 
                           'Restricted by Policy'}
                        </div>
                      </div>
                    </div>
                    {wakeLockStatus !== 'granted' && (
                      <button 
                        onClick={requestWakeLock}
                        className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                  
                  {wakeLockStatus === 'denied' && (
                    <div className="p-4 bg-red-500/5">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[11px] text-red-400 font-medium">Policy Restriction Detected</p>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            The "screen-wake-lock" policy is disabled for this document. Use the "Official Backway" above to resolve this.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Compatibility Section */}
              <section className="space-y-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold px-1">Emergency Workaround</div>
                <div className="bg-[#141414] rounded-2xl border border-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-white">Force Compatibility Mode</div>
                      <p className="text-[10px] text-zinc-500 max-w-[200px]">
                        Uses a hidden video loop to keep the screen awake if official permissions are blocked.
                      </p>
                    </div>
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${wakeLockStatus === 'fallback' ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${wakeLockStatus === 'fallback' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Battery Optimization Section */}
              <section className="space-y-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold px-1">Device Optimization</div>
                <div className="bg-[#141414] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <Battery className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">Battery Optimization</div>
                        <div className="text-xs text-zinc-500">Prevent system from killing clock</div>
                      </div>
                    </div>
                    <div className="pl-14 pr-4 py-3 bg-black/40 rounded-xl border border-white/5">
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Go to <span className="text-white">Settings → Apps → Onyx Clock → Battery</span> and select <span className="text-amber-500">"Unrestricted"</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Policy Warning */}
              {wakeLockStatus === 'denied' && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-red-500">Permission Policy Denied</div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your current browser environment is blocking hardware access. Please use the "Install App" method above to resolve this officially.
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Action */}
            <div className="p-6 bg-[#0F0F0F] border-t border-white/5">
              <button 
                onClick={() => setShowSetup(false)}
                className="w-full py-4 rounded-2xl bg-white text-black font-bold text-sm tracking-wide active:scale-[0.98] transition-all"
              >
                Save & Apply Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
