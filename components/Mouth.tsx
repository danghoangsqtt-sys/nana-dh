
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EyeState, Emotion } from '../types';

interface MouthProps {
  eyeState: EyeState;
  emotion: Emotion;
  volume: number; // Volume from Mic (Used for listening reactivity)
}

const Mouth: React.FC<MouthProps> = ({ eyeState, emotion, volume }) => {
  // SVG Path definitions for different emotions (Base shapes)
  const paths = {
    [Emotion.NEUTRAL]: "M 10 15 Q 25 15 40 15", // Flat line
    [Emotion.HAPPY]: "M 10 10 Q 25 25 40 10",   // Smile
    [Emotion.EXCITED]: "M 5 5 Q 25 45 45 5",    // Big Smile / Laughing (Deep U)
    [Emotion.SAD]: "M 10 20 Q 25 5 40 20",      // Frown
    [Emotion.SURPRISED]: "M 20 5 Q 35 5 35 20 Q 35 35 20 35 Q 5 35 5 20 Q 5 5 20 5", // Circle 'O'
    [Emotion.ANGRY]: "M 10 20 Q 25 5 40 20",    // Similar to frown
  };

  const [speakingPath, setSpeakingPath] = useState(paths[Emotion.NEUTRAL]);
  const [mouthOffset, setMouthOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (eyeState === EyeState.SPEAKING) {
      // Procedural Speaking Animation
      // Uses a combination of sine waves to simulate speech cadence (syllables)
      interval = setInterval(() => {
         const time = Date.now() / 150;
         
         // Generates a value roughly between 0 and 1, oscillating organically
         const wave = Math.abs(Math.sin(time) * Math.sin(time * 1.5) + (Math.sin(time * 0.5) * 0.2));
         
         const minOpen = 10;
         const maxOpen = 35; // Maximum pixel depth of mouth opening
         const currentOpen = minOpen + (wave * (maxOpen - minOpen));

         // Jitter Position slightly
         setMouthOffset({
             x: (Math.random() - 0.5) * 1,
             y: (Math.random() - 0.5) * 1
         });

         let d = "";

         if (emotion === Emotion.EXCITED) {
             const controlY = 30 + (wave * 20); 
             d = `M 5 5 Q 25 ${controlY} 45 5`;
         }
         else if (emotion === Emotion.HAPPY) {
            const controlY = 25 + (wave * 15);
            d = `M 10 10 Q 25 ${controlY} 40 10`;
         } 
         else if (emotion === Emotion.SURPRISED) {
             // O shape pulses
             d = paths[Emotion.SURPRISED]; // Keep O shape mostly
         }
         else if (emotion === Emotion.ANGRY) {
            const controlY = 15 + (wave * 10);
            d = `M 10 20 Q 25 ${controlY} 40 20`;
         }
         else {
            // NEUTRAL / NORMAL SPEECH
            const controlY = 15 + (wave * 20); // Base 15, opens up to 35
            d = `M 10 15 Q 25 ${controlY} 40 15`;
         }
         
         setSpeakingPath(d);

      }, 40); // 25 FPS smoother update
    } 
    else {
      // Reset position jitter
      setMouthOffset({ x: 0, y: 0 });

      // --- BREATHING / IDLE / LISTENING ANIMATION ---
      interval = setInterval(() => {
        const time = Date.now();
        const phase = time / 1000;
        const offset = Math.sin(phase * 2) * 1.5;

        // If LISTENING, modulate slight tension with volume
        let tension = 0;
        if (eyeState === EyeState.LISTENING) {
            tension = Math.min(volume / 20, 3); // Up to 3px shift based on volume
        }

        let d = paths[emotion];
        if (!d) d = paths[Emotion.NEUTRAL];

        if (emotion === Emotion.NEUTRAL) {
            // Neutral + Breathing + Listening Tension (Tightens mouth slightly)
            d = `M 10 15 Q 25 ${15 + offset - tension} 40 15`;
        } else if (emotion === Emotion.HAPPY) {
            d = `M 10 10 Q 25 ${25 + offset * 0.5} 40 10`;
        } else if (emotion === Emotion.EXCITED) {
            d = `M 5 5 Q 25 ${45 + offset * 1.5} 45 5`;
        } else if (emotion === Emotion.SAD) {
            d = `M 10 20 Q 25 ${5 + offset} 40 20`;
        } else if (emotion === Emotion.ANGRY) {
            d = `M 10 20 Q 25 ${5 + offset} 40 20`;
        }
        
        setSpeakingPath(d);
      }, 50);
    } 
    
    return () => clearInterval(interval);
  }, [eyeState, emotion, volume]); // Depend on volume for reactive listening

  return (
    <div className="flex justify-center items-center mt-8 h-12 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
      <svg width="50" height="60" viewBox="0 0 50 60" className="overflow-visible">
        <motion.path
          d={speakingPath}
          fill="transparent"
          stroke="white"
          strokeWidth={emotion === Emotion.EXCITED ? "3.5" : "3"}
          strokeLinecap="round"
          initial={false}
          animate={{
            d: speakingPath,
            stroke: emotion === Emotion.ANGRY ? "#ef4444" : "#ffffff",
            x: mouthOffset.x,
            y: mouthOffset.y,
          }}
          transition={{
            type: "tween", // Tween is smoother for continuous wave animation
            duration: 0.05,
            ease: "linear"
          }}
          style={{
            filter: "drop-shadow(0 0 5px rgba(255, 255, 255, 0.5))"
          }}
        />
      </svg>
    </div>
  );
};

export default Mouth;
