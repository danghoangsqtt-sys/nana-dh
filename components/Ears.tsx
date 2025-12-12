
import React from 'react';
import { motion } from 'framer-motion';
import { EyeState } from '../types';

interface EarsProps {
    state: EyeState;
    volume: number;
}

const Ears: React.FC<EarsProps> = ({ state, volume }) => {
    const isVisible = state === EyeState.LISTENING;

    // Reactivity factor based on volume (0-100)
    // Smoothing the volume for less jittery animation
    const volumeFactor = Math.min(volume / 50, 1);

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] flex justify-between items-center pointer-events-none -z-10 select-none">
            {/* Global Defs for Gradients */}
            <svg width="0" height="0">
                <defs>
                    <linearGradient id="earGradientLeft" x1="1" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="earGradientRight" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Left Ear */}
            <motion.div
                initial={{ opacity: 0, x: 50, scale: 0.8 }}
                animate={{
                    opacity: isVisible ? 1 : 0,
                    x: isVisible ? 0 : 50,
                    scale: isVisible ? 1 + (volumeFactor * 0.1) : 0.8,
                }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                className="relative w-24 h-48"
            >
                <svg viewBox="0 0 100 200" className="w-full h-full filter drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    {/* Outer Shell */}
                    <motion.path
                        d="M 90 190 Q 10 100 90 10"
                        fill="none"
                        stroke="url(#earGradientLeft)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    {/* Inner Reactive Ring 1 */}
                    <motion.path
                        d="M 90 160 Q 30 100 90 40"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{
                            opacity: 0.5 + (volumeFactor * 0.5),
                            pathLength: isVisible ? 0.3 + (volumeFactor * 0.7) : 0
                        }}
                        transition={{ type: "tween", duration: 0.1 }}
                    />
                    {/* Inner Reactive Ring 2 (High volume) */}
                    <motion.path
                        d="M 90 130 Q 50 100 90 70"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{
                            opacity: volumeFactor > 0.4 ? 1 : 0,
                            strokeWidth: 1 + volumeFactor * 3
                        }}
                    />
                </svg>
            </motion.div>

            {/* Right Ear */}
            <motion.div
                initial={{ opacity: 0, x: -50, scale: 0.8 }}
                animate={{
                    opacity: isVisible ? 1 : 0,
                    x: isVisible ? 0 : -50,
                    scale: isVisible ? 1 + (volumeFactor * 0.1) : 0.8,
                }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                className="relative w-24 h-48"
            >
                <svg viewBox="0 0 100 200" className="w-full h-full filter drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    {/* Outer Shell */}
                    <motion.path
                        d="M 10 190 Q 90 100 10 10"
                        fill="none"
                        stroke="url(#earGradientRight)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    {/* Inner Reactive Ring 1 */}
                    <motion.path
                        d="M 10 160 Q 70 100 10 40"
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{
                            opacity: 0.5 + (volumeFactor * 0.5),
                            pathLength: isVisible ? 0.3 + (volumeFactor * 0.7) : 0
                        }}
                        transition={{ type: "tween", duration: 0.1 }}
                    />
                    {/* Inner Reactive Ring 2 (High volume) */}
                    <motion.path
                        d="M 10 130 Q 50 100 10 70"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        animate={{
                            opacity: volumeFactor > 0.4 ? 1 : 0,
                            strokeWidth: 1 + volumeFactor * 3
                        }}
                    />
                </svg>
            </motion.div>

        </div>
    );
};

export default Ears;
