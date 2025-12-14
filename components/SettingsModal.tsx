import React, { useState, useRef, useEffect } from 'react';
import { UserSettings } from '../types';
import {
  X, User, Cpu, Info, Upload, Languages, ArrowRightLeft, Key,
  ExternalLink, ShieldCheck, RefreshCcw, Facebook, Phone, Zap,
  Mic, Volume2, Trash2, StopCircle, Play, Coffee, ChevronRight, Check
} from 'lucide-react';
import { getAudioContext, float32ToInt16, arrayBufferToBase64 } from '../utils/audioUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文 (Mandarin)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'th', name: 'ไทย (Thai)' },
];

const TABS = [
  { id: 'key', label: 'API Key', icon: Key },
  { id: 'user', label: 'Cá nhân hóa', icon: User },
  { id: 'voice', label: 'Giọng nói & Mic', icon: Mic },
  { id: 'translator', label: 'Phiên dịch', icon: Languages },
  { id: 'system', label: 'Hệ thống', icon: Cpu },
  { id: 'about', label: 'Thông tin', icon: Info },
] as const;

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('key');
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  // Check if a key was previously saved (mask it initially)
  const hasSavedKey = !!settings.apiKey && settings.apiKey.length > 5;

  useEffect(() => {
    setLocalSettings(settings);
    setIsEditingKey(!hasSavedKey);
  }, [settings, hasSavedKey, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: checked }));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: parseFloat(value) }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setLocalSettings(prev => ({ ...prev, fileContext: text }));
      };
      reader.readAsText(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = getAudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];

      setIsRecording(true);
      setRecordProgress(0);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      let progress = 0;
      const timer = setInterval(() => {
        progress += 2;
        setRecordProgress(progress);
        if (progress >= 100) stopCapture();
      }, 80);

      const stopCapture = () => {
        clearInterval(timer);
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        setRecordProgress(0);

        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Float32Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          result.set(c, offset);
          offset += c.length;
        }

        const pcm16 = float32ToInt16(result);
        const base64 = arrayBufferToBase64(pcm16.buffer as any);
        setLocalSettings(prev => ({ ...prev, userVoiceSample: base64 }));
      };

      (window as any)._stopVoiceCapture = stopCapture;

    } catch (e) {
      console.error("Mic access failed", e);
      alert("Không thể truy cập Microphone.");
    }
  };

  const stopRecordingManual = () => {
    if ((window as any)._stopVoiceCapture) {
      (window as any)._stopVoiceCapture();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 font-sans animate-in fade-in duration-200">

      {/* Main Card Container */}
      <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-5xl h-[85vh] md:h-[600px] shadow-2xl flex flex-col md:flex-row overflow-hidden relative">

        {/* --- Sidebar Navigation (Desktop) / Top Bar (Mobile) --- */}
        <div className="md:w-64 bg-neutral-900/50 border-b md:border-b-0 md:border-r border-white/5 flex flex-col shrink-0">
          {/* Header */}
          <div className="p-6 pb-2 md:pb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-900/20">
                <span className="font-bold text-white text-sm">N</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">Cài đặt</span>
            </div>
            <button onClick={onClose} className="md:hidden p-2 text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Nav Items */}
          <div className="flex md:flex-col overflow-x-auto md:overflow-visible px-4 md:px-3 gap-2 pb-4 md:pb-0 scrollbar-hide">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap md:whitespace-normal
                                ${isActive
                      ? 'bg-white/10 text-white font-medium shadow-inner'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                    }
                            `}
                >
                  <Icon size={18} className={isActive ? 'text-purple-400' : ''} />
                  <span className="text-sm">{tab.label}</span>
                  {isActive && <ChevronRight size={14} className="ml-auto hidden md:block opacity-50" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Content Area --- */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0F0F0F] relative">

          {/* Close Button (Desktop) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-neutral-500 hover:text-white hover:bg-white/10 rounded-full transition-colors hidden md:block"
          >
            <X size={20} />
          </button>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-2 fade-in duration-300">

              {/* --- API KEY --- */}
              {activeTab === 'key' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <ShieldCheck className="text-purple-500" />
                    Thiết lập Bảo mật
                  </h2>

                  <div className="p-5 bg-yellow-900/10 border border-yellow-700/20 rounded-2xl">
                    <p className="text-sm text-yellow-200/80 leading-relaxed">
                      API Key là chìa khóa để NaNa hoạt động. Nó được mã hóa an toàn trong trình duyệt của bạn và không bao giờ được chia sẻ ra ngoài.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-neutral-400 ml-1">Gemini API Key</label>
                    {!isEditingKey ? (
                      <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl group hover:border-white/20 transition-colors">
                        <div className="font-mono text-green-400 tracking-widest text-sm flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          ●●●●●●●●●●●●●●●●●●●
                        </div>
                        <button
                          onClick={() => {
                            setLocalSettings(prev => ({ ...prev, apiKey: '' }));
                            setIsEditingKey(true);
                          }}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-white rounded-lg transition-colors flex items-center gap-2 border border-white/5"
                        >
                          <RefreshCcw size={12} /> Thay đổi
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="password"
                          name="apiKey"
                          value={localSettings.apiKey || ''}
                          onChange={handleInputChange}
                          placeholder="Dán API Key (AIzaSy...)"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none font-mono text-sm transition-all shadow-inner"
                          autoComplete="off"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  {/* Detailed Instructions */}
                  <div className="pt-6 border-t border-white/5">
                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                      <Info size={16} className="text-blue-400" />
                      Hướng dẫn lấy API Key miễn phí
                    </h3>
                    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                      <ol className="space-y-4">
                        <li className="flex gap-4 text-xs text-neutral-400">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 font-mono text-[10px] border border-white/5 shadow-inner">1</span>
                          <span className="pt-1 leading-relaxed">
                            Truy cập vào <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline font-medium inline-flex items-center gap-1">Google AI Studio Dashboard <ExternalLink size={10} /></a>.
                          </span>
                        </li>
                        <li className="flex gap-4 text-xs text-neutral-400">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 font-mono text-[10px] border border-white/5 shadow-inner">2</span>
                          <span className="pt-1 leading-relaxed">Đăng nhập bằng tài khoản Google (Gmail) của bạn.</span>
                        </li>
                        <li className="flex gap-4 text-xs text-neutral-400">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 font-mono text-[10px] border border-white/5 shadow-inner">3</span>
                          <span className="pt-1 leading-relaxed">Nhấn vào nút màu xanh <strong className="text-white bg-white/10 px-1 rounded">Create API Key</strong> (hoặc "Get API Key").</span>
                        </li>
                        <li className="flex gap-4 text-xs text-neutral-400">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-500 font-mono text-[10px] border border-white/5 shadow-inner">4</span>
                          <span className="pt-1 leading-relaxed">Chọn "Create API key in new project", sau đó sao chép đoạn mã bắt đầu bằng <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-green-400 font-mono border border-white/5">AIza...</code> và dán vào ô bên trên.</span>
                        </li>
                      </ol>

                      <div className="mt-6">
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-xl transition-all text-xs font-semibold group hover:border-blue-500/40"
                        >
                          Đến trang lấy Key ngay
                          <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- USER PROFILE --- */}
              {activeTab === 'user' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold mb-6">Cá nhân hóa</h2>

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <label className="text-sm text-neutral-400 ml-1">Tên hiển thị (Biệt danh)</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
                        <input
                          type="text"
                          name="userName"
                          value={localSettings.userName}
                          onChange={handleInputChange}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:bg-white/10 focus:border-purple-500/50 outline-none transition-all"
                          placeholder="Ví dụ: Ông chủ"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-neutral-400 ml-1">Ngôn ngữ giao diện</label>
                      <div className="relative">
                        <select
                          name="language"
                          value={localSettings.language || 'vi'}
                          onChange={handleInputChange}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-4 pr-10 text-white appearance-none outline-none focus:bg-white/10 focus:border-purple-500/50"
                        >
                          <option value="vi">Tiếng Việt (Vietnamese)</option>
                          <option value="en">English (Tiếng Anh)</option>
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-neutral-500 pointer-events-none" size={16} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm text-neutral-400 ml-1">Knowledge Base (Tài liệu cá nhân)</label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-neutral-700 hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-full bg-neutral-800 group-hover:bg-purple-500/20 flex items-center justify-center mb-3 transition-colors">
                          <Upload size={20} className="text-neutral-400 group-hover:text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-neutral-300">
                          {localSettings.fileContext ? "Đã tải lên file context" : "Tải lên file .txt"}
                        </span>
                        <span className="text-xs text-neutral-500 mt-1">Cung cấp thông tin riêng cho NaNa</span>
                        <input type="file" accept=".txt" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- VOICE SETTINGS --- */}
              {activeTab === 'voice' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-semibold">Cài đặt Giọng nói</h2>

                  {/* Voice Sample Card */}
                  <div className="bg-gradient-to-br from-purple-900/10 to-blue-900/10 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Mic size={120} />
                    </div>

                    <h3 className="text-lg font-medium text-white mb-2">Mẫu giọng nói chủ nhân</h3>
                    <p className="text-sm text-neutral-400 mb-6 max-w-md">
                      Giúp NaNa nhận diện bạn chính xác hơn trong môi trường ồn ào và tránh phản hồi giọng người lạ.
                    </p>

                    <div className="flex flex-col items-center justify-center gap-6 py-4">
                      {localSettings.userVoiceSample ? (
                        <div className="flex flex-col items-center gap-4 w-full">
                          <div className="flex items-center gap-2 text-green-400 bg-green-500/10 px-6 py-3 rounded-full border border-green-500/20">
                            <ShieldCheck size={18} />
                            <span className="font-medium">Đã xác minh giọng nói</span>
                          </div>
                          <button
                            onClick={() => setLocalSettings(prev => ({ ...prev, userVoiceSample: '' }))}
                            className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-2 hover:underline"
                          >
                            <Trash2 size={12} /> Xóa mẫu hiện tại
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex flex-col items-center">
                          <button
                            onClick={isRecording ? stopRecordingManual : startRecording}
                            className={`
                                                    relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl
                                                    ${isRecording
                                ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] scale-110'
                                : 'bg-white text-black hover:scale-105'
                              }
                                                `}
                          >
                            {isRecording ? <div className="w-8 h-8 bg-white rounded-md" /> : <Mic size={32} />}

                            {/* Ripple Effect when recording */}
                            {isRecording && (
                              <>
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-20 animate-ping"></span>
                                <span className="absolute inline-flex h-[120%] w-[120%] rounded-full bg-red-400 opacity-10 animate-ping animation-delay-200"></span>
                              </>
                            )}
                          </button>

                          <div className="mt-6 w-full max-w-xs h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-red-500 transition-all duration-100 ease-linear"
                              style={{ width: `${recordProgress}%` }}
                            />
                          </div>
                          <p className="mt-4 text-xs text-neutral-500 text-center">
                            {isRecording ? "Đang ghi âm... Hãy nói một câu bất kỳ." : "Nhấn để bắt đầu ghi âm (4 giây)"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sensitivity */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Volume2 className="text-purple-400" size={20} />
                        <span className="font-medium text-white">Độ nhạy Micro</span>
                      </div>
                      <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-neutral-300">
                        {localSettings.voiceSensitivity?.toFixed(1) || 1.5}x
                      </span>
                    </div>
                    <input
                      type="range"
                      name="voiceSensitivity"
                      min="0.5"
                      max="5.0"
                      step="0.1"
                      value={localSettings.voiceSensitivity || 1.5}
                      onChange={handleSliderChange}
                      className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-500">
                      <span>Yên tĩnh (0.5x)</span>
                      <span>Mặc định (1.5x)</span>
                      <span>Ồn ào (5.0x)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TRANSLATOR --- */}
              {activeTab === 'translator' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold">Chế độ Phiên dịch</h2>
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-sm">
                    AI sẽ tự động lắng nghe và dịch hội thoại giữa hai ngôn ngữ này.
                  </div>

                  <div className="bg-white/5 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-xs text-neutral-400 ml-1">Ngôn ngữ A (Bạn)</label>
                      <select
                        name="translationLangA"
                        value={localSettings.translationLangA || 'vi'}
                        onChange={handleInputChange}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                      >
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                      </select>
                    </div>

                    <div className="bg-white/10 p-2 rounded-full rotate-90 md:rotate-0 text-white/50">
                      <ArrowRightLeft size={20} />
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <label className="text-xs text-neutral-400 ml-1">Ngôn ngữ B (Đối phương)</label>
                      <select
                        name="translationLangB"
                        value={localSettings.translationLangB || 'en'}
                        onChange={handleInputChange}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                      >
                        {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* --- SYSTEM --- */}
              {activeTab === 'system' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-semibold">Cấu hình Hệ thống</h2>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-400 ml-1">System Instructions (Prompt)</label>
                    <textarea
                      name="systemInstruction"
                      value={localSettings.systemInstruction}
                      onChange={handleInputChange}
                      rows={6}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-purple-500/50 resize-none font-mono text-sm leading-relaxed"
                      placeholder="Định nghĩa tính cách cho AI..."
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-500/20 text-purple-400 rounded-lg">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">Low Latency Mode</h4>
                        <p className="text-xs text-neutral-400">Giảm thời gian suy nghĩ để phản hồi nhanh hơn.</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="optimizeLatency"
                        checked={localSettings.optimizeLatency || false}
                        onChange={handleCheckboxChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* --- ABOUT --- */}
              {activeTab === 'about' && (
                <div className="flex flex-col items-center justify-center py-6 space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                    <div className="w-24 h-24 bg-[#0F0F0F] rounded-full relative flex items-center justify-center border border-white/10 z-10">
                      <span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">N</span>
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-3xl font-bold text-white">NaNa Live</h3>
                    <p className="text-neutral-400 tracking-widest text-xs uppercase">Next-Gen Realtime AI Assistant</p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-400 mt-2">
                      v5.0.0 <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    </div>
                  </div>

                  {/* Donate Card */}
                  <div className="w-full max-w-sm bg-neutral-900/80 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="flex items-center gap-2 text-amber-400 mb-4">
                        <Coffee size={18} />
                        <span className="font-semibold text-sm">Donate cho Developer</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-xl mb-4 transform group-hover:scale-105 transition-transform">
                        <img
                          src="https://img.vietqr.io/image/MB-052275580101-compact.png?amount=&addInfo=Donate%20NaNa%20AI&accountName=LE%20BA%20DANG%20HOANG"
                          alt="QR Donate"
                          className="w-40 h-auto mix-blend-multiply"
                        />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-xs text-neutral-400">MB Bank: <strong className="text-white select-all cursor-pointer">052275580101</strong></p>
                        <p className="text-xs text-neutral-500">LE BA DANG HOANG</p>
                      </div>
                    </div>
                  </div>

                  {/* Socials */}
                  <div className="flex gap-4">
                    <a href="https://web.facebook.com/danghoang.le.9" target="_blank" rel="noreferrer" className="p-3 bg-blue-600/10 text-blue-400 rounded-full hover:bg-blue-600/20 transition-colors">
                      <Facebook size={18} />
                    </a>
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-600/10 text-green-400 rounded-full border border-green-500/10 cursor-pointer select-all">
                      <Phone size={16} />
                      <span className="text-xs font-mono">0343019101</span>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 w-full text-center">
                    <p className="text-xs text-neutral-600">© 2024 DHsystem. All rights reserved.</p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* --- Footer Actions --- */}
          <div className="p-4 border-t border-white/5 bg-[#121212] flex justify-end gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => { onSave(localSettings); onClose(); }}
              className="px-8 py-2.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-neutral-200 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Lưu & Áp dụng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;