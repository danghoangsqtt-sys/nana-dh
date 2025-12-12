
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
    const volumeFactor = Math.min(volume / 50, 1);

    // Cấu hình vị trí:
    // Tổng chiều rộng mắt = 128px (mắt trái) + 24px (gap) + 128px (mắt phải) = 280px.
    // Container tai rộng 440px => Khoảng cách giữa 2 tai là 440 - (56*2) = 328px.
    // Khoảng cách (gap) mỗi bên = (328 - 280) / 2 = 24px (~1cm).

    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-32 flex justify-between items-center pointer-events-none -z-10 select-none">

            {/* Left Ear */}
            <motion.div
                initial={{ scale: 0, opacity: 0, x: 40 }}
                animate={{
                    scale: isVisible ? 1 + (volumeFactor * 0.1) : 0,
                    opacity: isVisible ? 1 : 0,
                    x: isVisible ? 0 : 40, // Slide out effect
                }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                className="relative w-14 h-28 bg-gradient-to-b from-[#1a1a1a] to-black rounded-[30px] border border-neutral-800 shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden"
            >
                {/* Glossy Reflection (Top) */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/5 rounded-full blur-[2px]"></div>

                {/* Inner Ear Speaker Mesh visual */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-16 bg-black rounded-[15px] border border-neutral-900 shadow-inner"></div>

                {/* Reactive Glow Indicator (Bottom) */}
                <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-6 h-1 bg-purple-500 rounded-full blur-[4px]"
                    animate={{
                        opacity: 0.2 + (volumeFactor * 0.8),
                        scaleX: 1 + volumeFactor
                    }}
                />
            </motion.div>

            {/* Right Ear */}
            <motion.div
                initial={{ scale: 0, opacity: 0, x: -40 }}
                animate={{
                    scale: isVisible ? 1 + (volumeFactor * 0.1) : 0,
                    opacity: isVisible ? 1 : 0,
                    x: isVisible ? 0 : -40, // Slide out effect
                }}
                transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                className="relative w-14 h-28 bg-gradient-to-b from-[#1a1a1a] to-black rounded-[30px] border border-neutral-800 shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden"
            >
                {/* Glossy Reflection (Top) */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-white/5 rounded-full blur-[2px]"></div>

                {/* Inner Ear Speaker Mesh visual */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-16 bg-black rounded-[15px] border border-neutral-900 shadow-inner"></div>

                {/* Reactive Glow Indicator (Bottom) */}
                <motion.div
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 w-6 h-1 bg-purple-500 rounded-full blur-[4px]"
                    animate={{
                        opacity: 0.2 + (volumeFactor * 0.8),
                        scaleX: 1 + volumeFactor
                    }}
                />
            </motion.div>

        </div>
    );
};

export default Ears;
