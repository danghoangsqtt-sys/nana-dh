
import React, { useState, useRef, useEffect } from 'react';
import { UserSettings } from '../types';
import { X, User, Cpu, Info, Upload, Languages, ArrowRightLeft, Key, ExternalLink, ShieldCheck, RefreshCcw, Facebook, Phone, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
}

const SUPPORTED_LANGUAGES = [
    { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
    { code: 'en', name: 'English (Tiếng Anh)' },
    { code: 'zh', name: '中文 (Chinese - Mandarin)' },
    { code: 'hi', name: 'हिन्दी (Hindi - Indian)' },
    { code: 'ru', name: 'Русский (Russian)' },
    { code: 'ko', name: '한국어 (Korean)' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'fr', name: 'Français (French)' },
    { code: 'de', name: 'Deutsch (German)' },
    { code: 'es', name: 'Español (Spanish)' },
    { code: 'it', name: 'Italiano (Italian)' },
    { code: 'pt', name: 'Português (Portuguese)' },
    { code: 'th', name: 'ไทย (Thai)' },
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'ar', name: 'العربية (Arabic)' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'key' | 'user' | 'system' | 'translator' | 'about'>('key');
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if a key was previously saved (mask it initially)
  const hasSavedKey = !!settings.apiKey && settings.apiKey.length > 5;

  useEffect(() => {
    setLocalSettings(settings);
    setIsEditingKey(!hasSavedKey); // If no key, default to edit mode
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

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col h-[600px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">NaNa Configuration</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-neutral-950 p-1 m-4 rounded-lg overflow-x-auto">
          {(['key', 'user', 'translator', 'system', 'about'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-neutral-800 text-white shadow' 
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab === 'key' && <Key size={16} />}
              {tab === 'user' && <User size={16} />}
              {tab === 'translator' && <Languages size={16} />}
              {tab === 'system' && <Cpu size={16} />}
              {tab === 'about' && <Info size={16} />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-6">
          
          {/* API KEY TAB */}
          {activeTab === 'key' && (
             <div className="space-y-6">
                <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-lg p-4">
                    <h3 className="text-yellow-500 font-semibold mb-2 flex items-center gap-2">
                        <ShieldCheck size={18} />
                        Bảo mật API Key
                    </h3>
                    <p className="text-sm text-yellow-200/80 leading-relaxed">
                        API Key sẽ được mã hóa trước khi lưu vào LocalStorage để đảm bảo an toàn. 
                        Sau khi lưu, bạn không thể xem lại toàn bộ ký tự của Key.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Gemini API Key
                    </label>
                    
                    {/* Logic for Saved vs Editing state */}
                    {!isEditingKey ? (
                        <div className="flex items-center gap-2 bg-green-900/20 border border-green-800/50 rounded-lg p-3">
                            <div className="flex-1 font-mono text-green-400 tracking-widest text-sm">
                                ●●●●●●●●●●●●●●●●●●● (Đã lưu)
                            </div>
                            <button 
                                onClick={() => {
                                    setLocalSettings(prev => ({ ...prev, apiKey: '' })); // Clear old key
                                    setIsEditingKey(true);
                                }}
                                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs text-white rounded transition-colors flex items-center gap-2"
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
                                placeholder="Dán API Key mới vào đây (AIzaSy...)"
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm"
                                autoComplete="off"
                            />
                             {/* No Eye Icon - Strictly secure input */}
                        </div>
                    )}

                    {(!localSettings.apiKey && isEditingKey) && (
                        <p className="text-xs text-red-400 mt-2">* Bắt buộc phải nhập API Key để sử dụng.</p>
                    )}
                </div>

                <div className="border-t border-neutral-800 pt-4">
                    <h4 className="text-sm font-medium text-white mb-3">Hướng dẫn lấy API Key:</h4>
                    <ol className="space-y-3 text-xs text-neutral-400 list-decimal pl-4">
                        <li>
                            Truy cập vào <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">Google AI Studio Dashboard <ExternalLink size={10} /></a>.
                        </li>
                        <li>Đăng nhập bằng tài khoản Google của bạn.</li>
                        <li>Nhấn vào nút <strong>Create API Key</strong> (Tạo khóa API).</li>
                        <li>Chọn dự án Google Cloud (hoặc tạo mới) nếu được hỏi.</li>
                        <li>Sao chép chuỗi ký tự bắt đầu bằng <code>AIza...</code> và dán vào ô bên trên.</li>
                        <li>Nhấn <strong>Save & Reload</strong>.</li>
                    </ol>
                </div>
             </div>
          )}

          {/* USER TAB */}
          {activeTab === 'user' && (
            <div className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1 flex items-center gap-2">
                  <Languages size={14} />
                  Interface Language / Ngôn ngữ
                </label>
                <div className="relative">
                    <select
                      name="language"
                      value={localSettings.language || 'vi'}
                      onChange={handleInputChange}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                    >
                      <option value="vi">Tiếng Việt (Vietnamese)</option>
                      <option value="en">English (Tiếng Anh)</option>
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">User Name</label>
                <input
                  type="text"
                  name="userName"
                  value={localSettings.userName}
                  onChange={handleInputChange}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">Knowledge Base (.txt)</label>
                <div 
                  className="border-2 border-dashed border-neutral-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={24} className="text-neutral-500 mb-2" />
                  <span className="text-xs text-neutral-400">
                    {localSettings.fileContext ? "File Context Loaded" : "Upload .txt for context"}
                  </span>
                  <input 
                    type="file" 
                    accept=".txt" 
                    ref={fileInputRef} 
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TRANSLATOR TAB */}
          {activeTab === 'translator' && (
             <div className="space-y-6">
                <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                    <p className="text-sm text-blue-200">
                        Chế độ phiên dịch trực tiếp giúp bạn giao tiếp giữa hai người nói hai ngôn ngữ khác nhau.
                    </p>
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-neutral-400 mb-1">Language A</label>
                        <select
                            name="translationLangA"
                            value={localSettings.translationLangA || 'vi'}
                            onChange={handleInputChange}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                            {SUPPORTED_LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-5">
                        <ArrowRightLeft className="text-neutral-500" size={20} />
                    </div>

                    <div className="flex-1">
                        <label className="block text-xs font-medium text-neutral-400 mb-1">Language B</label>
                        <select
                            name="translationLangB"
                            value={localSettings.translationLangB || 'en'}
                            onChange={handleInputChange}
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                        >
                             {SUPPORTED_LANGUAGES.map(lang => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="text-xs text-neutral-500 italic">
                    AI sẽ tự động phát hiện ngôn ngữ được nói và dịch sang ngôn ngữ còn lại.
                </div>
             </div>
          )}

          {/* SYSTEM TAB */}
          {activeTab === 'system' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">System Instructions (Assistant Persona)</label>
                <textarea
                  name="systemInstruction"
                  value={localSettings.systemInstruction}
                  onChange={handleInputChange}
                  rows={5}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-white outline-none resize-none font-mono text-xs"
                />
              </div>

              {/* Optimization Toggle */}
              <div className="flex items-center justify-between bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-900/30 rounded-full text-purple-400">
                          <Zap size={18} />
                      </div>
                      <div>
                          <p className="text-sm font-medium text-white">Chế độ phản hồi nhanh</p>
                          <p className="text-[10px] text-neutral-400">Giảm thời gian suy nghĩ để trả lời tức thì (Có thể giảm độ chi tiết)</p>
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
                      <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
              </div>

              <p className="text-xs text-neutral-500">
                  Note: Using Gemini 2.5 Flash Native Audio Preview (Zephyr Voice).
              </p>
            </div>
          )}

          {/* ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="text-center space-y-6 py-4">
              <div>
                <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-pink-600 rounded-full mx-auto flex items-center justify-center mb-4 text-3xl font-bold">
                    N
                </div>
                <h3 className="text-xl font-bold">NaNa Live</h3>
                <p className="text-neutral-400 text-sm">Next-Gen Realtime AI</p>
              </div>
              
              <div className="pt-8 border-t border-neutral-800">
                <p className="text-sm text-neutral-400 mb-4">
                    Bản quyền thuộc về <span className="font-bold text-white">DHsystem</span>
                </p>
                
                <div className="flex flex-col items-center gap-3">
                    <a 
                        href="https://web.facebook.com/?_rdc=1&_rdr#" 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800/50 rounded-lg text-blue-300 transition-all text-sm w-fit"
                    >
                        <Facebook size={16} />
                        Facebook DHsystem
                    </a>

                    <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg text-neutral-300 transition-all text-sm w-fit"
                    >
                        <Phone size={16} className="text-green-400" />
                        <span>Zalo: 0343019101</span>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-purple-900/20 transition-all"
          >
            Save & Reload
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
