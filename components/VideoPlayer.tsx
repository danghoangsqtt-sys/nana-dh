import React from 'react';
import { X, Youtube, ExternalLink, Search } from 'lucide-react';
import { VideoState } from '../types';

interface VideoPlayerProps {
  state: VideoState;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  // 1. Kiểm tra xem state.url có phải là Video ID chuẩn (11 ký tự) hay không
  // Regex: Chỉ chứa chữ cái, số, gạch dưới, gạch ngang và đúng 11 ký tự
  const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(state.url);

  // 2. Lấy origin hiện tại để đáp ứng yêu cầu bảo mật
  const origin = encodeURIComponent(window.location.origin);

  // 3. Xây dựng Link
  // Link Embed cho Iframe (Chỉ dùng khi có ID)
  const embedSrc = `https://www.youtube.com/embed/${state.url}?autoplay=1&controls=1&origin=${origin}&rel=0`;

  // Link mở tab mới (Dùng cho cả 2 trường hợp)
  const externalLink = isVideoId
    ? `https://www.youtube.com/watch?v=${state.url}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(state.url)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4">
      {/* Container chính */}
      <div className="relative w-full max-w-5xl aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">

        {/* --- HEADER --- */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-20 flex justify-between items-center pointer-events-none">
          {/* Title */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="p-1.5 bg-red-600 rounded-lg shadow-lg shadow-red-900/20">
              <Youtube className="text-white" size={18} />
            </div>
            <span className="font-medium text-white text-sm md:text-base tracking-wide drop-shadow-md truncate max-w-[180px] md:max-w-md">
              {state.title || "YouTube Player"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition-all text-xs text-white font-medium group"
              title="Mở tab mới"
            >
              <span className="hidden md:inline">Mở trên YouTube</span>
              <ExternalLink size={14} className="opacity-70 group-hover:opacity-100" />
            </a>

            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full backdrop-blur transition-all text-white hover:rotate-90 duration-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center">
          {isVideoId ? (
            // TRƯỜNG HỢP 1: CÓ ID -> HIỆN PLAYER
            <iframe
              width="100%"
              height="100%"
              src={embedSrc}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full object-cover z-10"
            ></iframe>
          ) : (
            // TRƯỜNG HỢP 2: TỪ KHÓA -> HIỆN THẺ PREVIEW (Tránh lỗi màn hình đen)
            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center text-center p-8 space-y-6 bg-neutral-900/50">

              {/* Background Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full pointer-events-none"></div>

              {/* Icon */}
              <div className="relative w-24 h-24 rounded-3xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center shadow-2xl shadow-black/50 mb-2">
                <Search size={40} className="text-neutral-400" />
                <div className="absolute -bottom-2 -right-2 bg-red-600 p-2 rounded-xl border-4 border-neutral-900">
                  <Youtube size={20} className="text-white" fill="currentColor" />
                </div>
              </div>

              {/* Text Info */}
              <div className="space-y-3 max-w-lg relative z-10">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Tìm kiếm video
                </h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  NaNa đang tìm kiếm từ khóa: <br />
                  <span className="text-white font-semibold italic">"{state.url}"</span>
                </p>
                <p className="text-neutral-500 text-xs pt-2">
                  (YouTube chặn phát trực tiếp danh sách tìm kiếm trên ứng dụng bên thứ 3)
                </p>
              </div>

              {/* Action Button */}
              <a
                href={externalLink}
                target="_blank"
                rel="noreferrer"
                className="relative z-10 flex items-center gap-3 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-all transform hover:scale-105 shadow-xl shadow-red-900/30 group"
              >
                <ExternalLink size={18} />
                <span>Xem kết quả trên YouTube</span>
                <span className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></span>
              </a>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VideoPlayer;