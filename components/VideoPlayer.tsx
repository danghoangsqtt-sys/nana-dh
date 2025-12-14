import React from 'react';
import { X, Youtube, ExternalLink, PlayCircle } from 'lucide-react';
import { VideoState } from '../types';

interface VideoPlayerProps {
  state: VideoState;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ state, onClose }) => {
  if (!state.isOpen) return null;

  // 1. Kiểm tra nghiêm ngặt xem URL có phải là Video ID không
  // Video ID chuẩn của YouTube luôn có đúng 11 ký tự
  const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(state.url);

  // Lấy origin để tuân thủ chính sách bảo mật
  const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';

  // Link mở sang tab mới (Dùng cho cả 2 trường hợp)
  const externalLink = isVideoId
    ? `https://www.youtube.com/watch?v=${state.url}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(state.url)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4">
      {/* Khung Player */}
      <div className="relative w-full max-w-5xl aspect-video bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800 flex flex-col">

        {/* --- HEADER --- */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-20 flex justify-between items-center pointer-events-none">
          {/* Tiêu đề */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <div className="p-1.5 bg-red-600 rounded-lg shadow-lg shadow-red-900/20">
              <Youtube className="text-white" size={18} />
            </div>
            <span className="font-medium text-white text-sm md:text-lg tracking-wide drop-shadow-md truncate max-w-[200px] md:max-w-xl">
              {state.title || "YouTube Player"}
            </span>
          </div>

          {/* Nút đóng & Mở tab mới */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur transition-all text-xs md:text-sm text-white font-medium group"
            >
              <span className="hidden sm:inline">Mở trên YouTube</span>
              <ExternalLink size={16} className="opacity-70 group-hover:opacity-100" />
            </a>

            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full backdrop-blur transition-all text-white hover:rotate-90 duration-200"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* --- NỘI DUNG CHÍNH (QUAN TRỌNG) --- */}
        <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center overflow-hidden">

          {isVideoId ? (
            /* TRƯỜNG HỢP 1: CÓ ID -> HIỆN PLAYER */
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${state.url}?autoplay=1&controls=1&origin=${origin}&rel=0&modestbranding=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="w-full h-full object-cover z-10"
            ></iframe>
          ) : (
            /* TRƯỜNG HỢP 2: TỪ KHÓA -> HIỆN THẺ PREVIEW (Thay thế hoàn toàn Iframe lỗi) */
            <div className="relative w-full h-full flex flex-col items-center justify-center text-center p-6 bg-neutral-900">

              {/* Hiệu ứng nền */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-xl scale-110"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/80 to-transparent"></div>

              {/* Nội dung Card */}
              <div className="relative z-10 max-w-lg space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-500">
                <div className="w-20 h-20 mx-auto bg-neutral-800 rounded-3xl flex items-center justify-center shadow-2xl border border-neutral-700">
                  <PlayCircle size={40} className="text-red-500" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl md:text-3xl font-bold text-white">
                    Kết quả tìm kiếm
                  </h3>
                  <p className="text-neutral-400 text-base">
                    NaNa đã tìm thấy video cho từ khóa: <br />
                    <span className="text-blue-400 font-semibold italic">"{state.url}"</span>
                  </p>
                </div>

                <div className="pt-4">
                  <a
                    href={externalLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-xl shadow-red-900/40"
                  >
                    <Youtube size={24} fill="currentColor" />
                    <span>Xem ngay trên YouTube</span>
                  </a>
                  <p className="mt-4 text-xs text-neutral-600">
                    *Video này không hỗ trợ phát trực tiếp trên ứng dụng do bản quyền.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VideoPlayer;