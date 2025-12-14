import React from 'react';
import { X, Youtube } from 'lucide-react';
import { VideoState } from '../types';

interface VideoPlayerProps {
  state: VideoState;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  // Kiểm tra xem state.url có phải là Video ID chuẩn (11 ký tự) hay không
  // Regex: Chữ cái, số, gạch dưới, gạch ngang, đúng 11 ký tự
  const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(state.url);

  // Xây dựng URL embed dựa trên kết quả kiểm tra
  // - Nếu là ID: Dùng link embed trực tiếp
  // - Nếu là Keyword: Dùng link embed search query
  const embedSrc = isVideoId
    ? `https://www.youtube.com/embed/${state.url}?autoplay=1&controls=1&modestbranding=1&rel=0`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(state.url)}&autoplay=1&controls=1&modestbranding=1&rel=0`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-2 text-white pointer-events-auto">
            <Youtube className="text-red-500" />
            <span className="font-semibold tracking-wide drop-shadow-md truncate max-w-[70vw]">{state.title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition-all text-white pointer-events-auto cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        {/* Player Content */}
        <div className="w-full h-full flex items-center justify-center bg-black">
          <iframe
            width="100%"
            height="100%"
            src={embedSrc}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full object-cover"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;