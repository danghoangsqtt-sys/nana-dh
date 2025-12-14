import React from 'react';
import { X, Youtube, ExternalLink } from 'lucide-react';
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

  // Lấy origin hiện tại để đáp ứng yêu cầu bảo mật của YouTube Embed API
  const origin = encodeURIComponent(window.location.origin);

  // Xây dựng URL embed với chế độ Preview (autoplay=0) và tham số origin
  // - Nếu là ID: Dùng link embed trực tiếp
  // - Nếu là Keyword: Dùng link embed search query
  const embedSrc = isVideoId
    ? `https://www.youtube.com/embed/${state.url}?autoplay=0&controls=1&origin=${origin}&rel=0`
    : `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(state.url)}&autoplay=0&controls=1&origin=${origin}&rel=0`;

  // Tạo link fallback để mở trực tiếp trên YouTube nếu bị chặn nhúng
  const externalLink = isVideoId
    ? `https://www.youtube.com/watch?v=${state.url}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(state.url)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-neutral-800">

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-2 text-white pointer-events-auto">
            <Youtube className="text-red-500" />
            <span className="font-semibold tracking-wide drop-shadow-md truncate max-w-[50vw] md:max-w-[60vw]">{state.title}</span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Nút Fallback: Mở tab mới nếu video bị lỗi nhúng */}
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition-all text-white cursor-pointer group relative"
              title="Mở trên YouTube (Nếu video bị lỗi)"
            >
              <ExternalLink size={20} />
            </a>

            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition-all text-white cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Player Content */}
        <div className="w-full h-full flex items-center justify-center bg-black">
          <iframe
            width="100%"
            height="100%"
            src={embedSrc}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="w-full h-full object-cover"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;