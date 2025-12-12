
import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { EyeState, Emotion } from '../types';

interface EyesProps {
  state: EyeState;
  emotion: Emotion;
  volume: number; // Reactive volume (Mic)
}

// Physics configuration for "Pixar-like" snappy but organic movement
const PUPIL_SPRING = { type: "spring", stiffness: 400, damping: 28, mass: 0.8 };
const LID_SPRING = { type: "spring", stiffness: 300, damping: 35, mass: 1.2 };

const Eyes: React.FC<EyesProps> = ({ state, emotion, volume }) => {
  const [blink, setBlink] = useState(false);
  const [lookCoords, setLookCoords] = useState({ x: 0, y: 0 });
  const lastState = useRef(state);

  // 1. Blink Logic (Automatic Blinking)
  useEffect(() => {
    // Don't blink while thinking to maintain "intense focus" look
    // Also don't blink if already squinting very hard (EXCITED)
    if (state === EyeState.THINKING || emotion === Emotion.EXCITED) return;

    const scheduleBlink = () => {
       const delay = 2500 + Math.random() * 4000; // Random 2.5s - 6.5s
       return setTimeout(() => {
          setBlink(true);
          setTimeout(() => setBlink(false), 180); // Fast blink (180ms)
       }, delay);
    };

    let timeoutId = scheduleBlink();
    
    // Cleanup ensures we don't get stuck blinking
    const blinkInterval = setInterval(() => {
        if(!blink) {
            clearTimeout(timeoutId);
            timeoutId = scheduleBlink();
        }
    }, 6000); 

    return () => {
        clearTimeout(timeoutId);
        clearInterval(blinkInterval);
    };
  }, [state, blink, emotion]);

  // 2. Gaze Logic (Eye Movement)
  useEffect(() => {
    let interval: any;

    const triggerMove = () => {
        // Reset when state changes
        if (state !== lastState.current) {
            lastState.current = state;
            setLookCoords({ x: 0, y: 0 }); 
        }

        if (state === EyeState.SPEAKING) {
            // SPEAKING JITTER: Rapid, small random movements
            // Creates the illusion of vocal effort/vibration
            interval = setInterval(() => {
                setLookCoords({
                    x: (Math.random() - 0.5) * 6, 
                    y: (Math.random() - 0.5) * 4
                });
            }, 120); // Fast frequency
        } 
        else if (state === EyeState.THINKING) {
            // THINKING: Look Up-Right or Up-Left (Accessing cues) then Scan
            let step = 0;
            interval = setInterval(() => {
                step++;
                // Pattern: Up Right -> Up Left -> Center Up -> Repeat
                if (step % 3 === 0) setLookCoords({ x: 15, y: -20 });
                else if (step % 3 === 1) setLookCoords({ x: -15, y: -20 });
                else setLookCoords({ x: 0, y: -25 });
            }, 800);
        } 
        else if (state === EyeState.LISTENING) {
            // LISTENING: Locked contact, follow volume slightly?
            // Mainly relies on pupil dilation (handled in render)
            // Just faint breathing movement
            interval = setInterval(() => {
                const time = Date.now() / 1000;
                setLookCoords({
                    x: Math.sin(time) * 2,
                    y: Math.cos(time * 0.5) * 2
                });
            }, 50);
        } 
        else {
            // IDLE: Saccadic Movement
            // Eyes jump to a point, fixate, then jump again.
            const saccade = () => {
                // 80% chance to look near center, 20% to look away
                const isFar = Math.random() > 0.8;
                const range = isFar ? 20 : 5;
                
                setLookCoords({
                    x: (Math.random() - 0.5) * 2 * range,
                    y: (Math.random() - 0.5) * 1.5 * range
                });
                
                // Random time until next saccade (human eyes move 3-4 times/sec usually, but AI can be calmer)
                const nextTime = 1000 + Math.random() * 3000;
                interval = setTimeout(saccade, nextTime);
            };
            saccade();
        }
    };

    triggerMove();

    return () => {
        clearInterval(interval);
        clearTimeout(interval);
    };
  }, [state]);

  // Calculate Geometry based on state AND emotion
  const getEyeHeight = () => {
    if (blink) return 4;
    
    // Emotion overrides first
    if (emotion === Emotion.EXCITED) return 22; // Very tight squint (Laughing eyes)
    if (emotion === Emotion.HAPPY) return 60; // "Smiling eyes" (inverted U shape simulation)
    if (emotion === Emotion.SURPRISED) return 190; // Wide open
    if (emotion === Emotion.ANGRY) return 120; // Slightly narrowed
    if (emotion === Emotion.SAD) return 130; // Droopy

    // State overrides
    if (state === EyeState.THINKING) return 110; // Squint
    if (state === EyeState.LISTENING) return 170; // Wide open
    
    // Dynamic Speaking Height: Reacts slightly to simulated rhythm
    if (state === EyeState.SPEAKING) {
        // Base 150 + subtle pulse
        const pulse = Math.sin(Date.now() / 100) * 10;
        return 150 + pulse; 
    }
    return 150; // Idle
  };

  const getBorderRadius = () => {
      if (blink) return "10px";
      
      // Emotion shapes
      if (emotion === Emotion.EXCITED) return "40% 40% 60% 60%"; // Sharp squint
      if (emotion === Emotion.HAPPY) return "10% 10% 50% 50%"; // Inverted arch look
      if (emotion === Emotion.SURPRISED) return "50%";
      if (emotion === Emotion.ANGRY) return "50% 50% 40% 40%"; // Sharp top

      if (state === EyeState.THINKING) return "40% 40% 45% 45%"; // Squint shape
      if (state === EyeState.LISTENING) return "50%"; // Perfect circle
      return "48% 48% 50% 50%";
  };

  const getRotate = () => {
      if (emotion === Emotion.EXCITED) return 5; // Slight happy tilt
      if (emotion === Emotion.ANGRY) return 10; // Slant inwards
      if (emotion === Emotion.SAD) return -10; // Slant outwards
      return 0;
  };

  return (
    <div className="flex gap-6 justify-center items-center h-48 filter drop-shadow-[0_0_25px_rgba(59,130,246,0.2)]">
      <Eye 
        lookCoords={lookCoords} 
        height={getEyeHeight()} 
        borderRadius={getBorderRadius()}
        state={state}
        rotate={getRotate()}
        isLeft={true}
        emotion={emotion}
        volume={volume}
      />
      <Eye 
        lookCoords={lookCoords} 
        height={getEyeHeight()} 
        borderRadius={getBorderRadius()}
        state={state}
        rotate={-getRotate()} // Mirror rotation
        isLeft={false}
        emotion={emotion}
        volume={volume}
      />
    </div>
  );
};

const Eye = ({ lookCoords, height, borderRadius, state, rotate, isLeft, emotion, volume }: any) => {
  // Pupil Scale Logic
  const getPupilScale = () => {
      if (emotion === Emotion.EXCITED) return 0.7; // Smaller pupils when laughing hard
      
      // Reactive Listening: Dilate based on User Mic Volume
      if (state === EyeState.LISTENING) {
          // Base 1.35 + Volume influence
          // Volume is typically 0-100, scale it down
          return 1.35 + Math.min(volume / 50, 0.4); 
      }
      
      // Shrink slightly when thinking (internal focus)
      if (state === EyeState.THINKING) return 0.85;
      return 1;
  };

  return (
    <motion.div
      className="w-32 bg-slate-100 relative overflow-hidden border border-slate-200/20"
      style={{
          // Deep inset shadow for the "socket" feel + outer glow
          boxShadow: "inset 0 -20px 30px rgba(0,0,0,0.15), inset 0 10px 15px rgba(255,255,255,0.8), 0 0 15px rgba(255,255,255,0.1)"
      }}
      animate={{
        height: height,
        borderRadius: borderRadius,
        transform: `scale(${state === EyeState.SPEAKING ? 1.02 : 1}) rotate(${rotate}deg)`,
      }}
      transition={LID_SPRING}
    >
      {/* The Iris/Pupil Complex */}
      <motion.div
        className="absolute w-20 h-20 rounded-full"
        style={{
            // Complex gradient for depth
            background: "radial-gradient(circle at 35% 35%, #555555 0%, #1a1a1a 45%, #000000 100%)",
            boxShadow: "0 0 20px rgba(0,0,0,0.6)",
            left: '50%',
            top: '50%',
            x: '-50%',
            y: '-50%',
        }}
        animate={{
          x: `calc(-50% + ${lookCoords.x}px)`,
          y: `calc(-50% + ${lookCoords.y}px)`,
          scale: getPupilScale(),
        }}
        transition={PUPIL_SPRING}
      >
        {/* Primary Reflection (The "Sparkle") */}
        <div className="absolute top-4 right-5 w-7 h-5 bg-white rounded-[50%] rotate-[25deg] opacity-95 blur-[0.5px]"></div>
        
        {/* Secondary Reflection (Fill light) */}
        <div className="absolute top-10 right-3 w-2 h-2 bg-white rounded-full opacity-50"></div>
        
        {/* Bottom Caustic Glow (Subsurface scattering - simulates wet eye surface) */}
        <div className="absolute bottom-2 left-3 w-12 h-8 bg-blue-400/30 blur-md rounded-full rotate-[-15deg]"></div>
      </motion.div>
    </motion.div>
  );
};

export default Eyes;
