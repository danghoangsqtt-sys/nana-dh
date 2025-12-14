
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanelLeftOpen, Key, User, Sparkles } from 'lucide-react';
import { UserSettings, EyeState, Emotion, UserLocation, ChatSession, ChatMessage, AppMode } from './types';
import Eyes from './components/Eyes';
import Mouth from './components/Mouth';
import SettingsModal from './components/SettingsModal';
import Sidebar from './components/Sidebar';
import VideoPlayer from './components/VideoPlayer';
import AODDisplay from './components/AODDisplay';
import Toast from './components/Toast';
import { useGeminiLive } from './hooks/useGeminiLive';
import { encryptKey, decryptKey } from './utils/crypto';

// Default Settings
const DEFAULT_SETTINGS: UserSettings = {
    userName: 'Ông chủ',
    systemInstruction: 'NaNa là trợ lý tận tụy của Ông chủ (Đăng Hoàng).',
    fileContext: '',
    language: 'vi',
    translationLangA: 'vi', // Vietnamese
    translationLangB: 'en',  // English
    apiKey: '',
    optimizeLatency: false, // Default to standard mode (thinking enabled if model supports)
    voiceSensitivity: 1.5, // Default gain
    userVoiceSample: '' // No sample by default
};

const RANDOM_QUOTES = [
    "Sống chậm lại, yêu thương nhiều hơn.",
    "Hôm nay trời đẹp quá, ông chủ có muốn đi dạo không?",
    "NaNa luôn ở đây khi ông chủ cần.",
    "Đừng làm việc quá sức nhé!",
];

// Helper to generate UUID
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
    // State
    const [settings, setSettings] = useState<UserSettings>(() => {
        const saved = localStorage.getItem('nana_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.apiKey) parsed.apiKey = decryptKey(parsed.apiKey);
            // Merge with defaults to ensure new fields exist
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
        return DEFAULT_SETTINGS;
    });

    const [currentTime, setCurrentTime] = useState(new Date());

    // Session Management State
    const [sessions, setSessions] = useState<ChatSession[]>(() => {
        const saved = localStorage.getItem('nana_sessions');
        return saved ? JSON.parse(saved) : [];
    });
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [quote, setQuote] = useState(RANDOM_QUOTES[0]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [toastAction, setToastAction] = useState<(() => void) | undefined>(undefined);
    const [apiKeyReady, setApiKeyReady] = useState(false);

    // Location State
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [locStatus, setLocStatus] = useState<string>("Đang định vị...");

    // Chat Scroll Ref
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null); // New anchor for scrolling

    // Save Sessions to LocalStorage whenever they change
    useEffect(() => {
        localStorage.setItem('nana_sessions', JSON.stringify(sessions));
    }, [sessions]);

    // Handle responsive sidebar behavior
    // Breakpoint changed to 1024px (lg) to treat vertical tablets as mobile-like layout
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch Geolocation on Mount
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
                    setLocStatus("Đã xác định vị trí");
                },
                (err) => {
                    console.error("Geo error:", err);
                    setLocation({ lat: 21.0285, lng: 105.8542 });
                }
            );
        } else {
            setLocation({ lat: 21.0285, lng: 105.8542 });
        }
    }, []);

    // Check for API Key
    useEffect(() => {
        const checkKey = async () => {
            if ((settings.apiKey && settings.apiKey.length > 10) || process.env.API_KEY) {
                setApiKeyReady(true);
                return;
            }
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const has = await window.aistudio.hasSelectedApiKey();
                setApiKeyReady(has);
                return;
            }
            setApiKeyReady(false);
        };
        checkKey();
    }, [settings.apiKey]);

    // --- Session Management Functions ---

    const handleCreateSession = () => {
        const newSession: ChatSession = {
            id: generateId(),
            title: "Đoạn chat mới",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isPinned: false
        };
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);

        // On mobile/tablet, close sidebar when creating new chat
        if (window.innerWidth < 1024) setIsSidebarOpen(false);

        return newSession.id;
    };

    const handleSelectSession = (id: string) => {
        setCurrentSessionId(id);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };

    const handleDeleteSession = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
            setCurrentSessionId(null);
        }
    };

    const handleTogglePinSession = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setSessions(prev => prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s));
    };

    const handleRenameSession = (id: string, newTitle: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    };

    // Handler for opening settings from Voice Command (Passed to hook)
    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
        setToastMessage("Đang mở cài đặt...");
    }, []);

    // --- Gemini Integration Logic ---
    const {
        state,
        videoState,
        setVideoState,
        isDeepSleep,
        setIsDeepSleep,
        connect,
        disconnect,
        active,
        error,
        clearError,
        liveTranscript,
        mode,
        setMode,
        history: hookHistory,
        volume
    } = useGeminiLive(settings, location, handleOpenSettings);

    const processedHistoryLengthRef = useRef(0);
    const gemini = {
        state, videoState, setVideoState, isDeepSleep, setIsDeepSleep, connect, disconnect, active, error, clearError, liveTranscript, mode, setMode, history: hookHistory, volume,
        clearHistory: () => { } // Shim if needed, real logic is inside useGeminiLive reset
    };

    // Sync Hook History to Persistent Session
    useEffect(() => {
        if (!gemini.active) {
            processedHistoryLengthRef.current = 0;
            return;
        }

        if (!currentSessionId) {
            handleCreateSession();
            return;
        }

        const currentHookHistory = gemini.history;
        const newMessagesCount = currentHookHistory.length - processedHistoryLengthRef.current;

        if (newMessagesCount > 0) {
            const newMessages = currentHookHistory.slice(processedHistoryLengthRef.current);

            setSessions(prevSessions => {
                return prevSessions.map(session => {
                    if (session.id === currentSessionId) {
                        const updatedMessages = [...session.messages, ...newMessages];
                        let updatedTitle = session.title;
                        const aiMsgIndex = updatedMessages.findIndex(m => m.role === 'model');
                        if (session.title === "Đoạn chat mới" && aiMsgIndex !== -1) {
                            const firstAiText = updatedMessages[aiMsgIndex].text;
                            updatedTitle = firstAiText.substring(0, 40).replace(/["*_]/g, '') + (firstAiText.length > 40 ? '...' : '');
                        }
                        return { ...session, messages: updatedMessages, updatedAt: Date.now(), title: updatedTitle };
                    }
                    return session;
                });
            });
            processedHistoryLengthRef.current = currentHookHistory.length;
        }
    }, [gemini.history, gemini.active, currentSessionId]);

    // Handle errors
    useEffect(() => {
        if (gemini.error) {
            let displayError = gemini.error;
            if (gemini.error.includes('entity was not found') || gemini.error.includes('404')) {
                displayError = "API Key không hỗ trợ Model này (hoặc Project bị xóa). Vui lòng nhập Key mới.";
                setSettings(prev => ({ ...prev, apiKey: '' }));
                localStorage.removeItem('nana_settings');
                setApiKeyReady(false);
                setToastAction(() => () => setIsSettingsOpen(true));
            }
            else if (gemini.error.includes('Key') || gemini.error.includes('403') || gemini.error.includes('Permission')) {
                displayError = "API Key không hợp lệ hoặc hết hạn.";
                setSettings(prev => ({ ...prev, apiKey: '' }));
                setApiKeyReady(false);
                setToastAction(() => () => setIsSettingsOpen(true));
            }
            else if (gemini.error.includes('Lỗi mạng') || gemini.error.includes('Network Error')) {
                displayError = "Không thể kết nối. Vui lòng kiểm tra mạng.";
                setToastAction(undefined);
            }
            setToastMessage(displayError);
        }
    }, [gemini.error]);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        if (new Date().getSeconds() === 0) {
            setQuote(RANDOM_QUOTES[Math.floor(Math.random() * RANDOM_QUOTES.length)]);
        }
        return () => clearInterval(timer);
    }, []);

    const handleSaveSettings = (newSettings: UserSettings) => {
        setSettings(newSettings);
        const settingsToSave = { ...newSettings };
        if (settingsToSave.apiKey) settingsToSave.apiKey = encryptKey(settingsToSave.apiKey);
        localStorage.setItem('nana_settings', JSON.stringify(settingsToSave));
        if (gemini.active) {
            gemini.disconnect();
            setToastMessage("Đã lưu cài đặt. Hãy khởi động lại NaNa.");
        }
    };

    const handleMainAction = async () => {
        if (gemini.active) {
            gemini.disconnect();
            return;
        }
        const hasLocalKey = settings.apiKey && settings.apiKey.length > 10;
        const hasEnvKey = !!process.env.API_KEY;

        if (!hasLocalKey && !hasEnvKey) {
            if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
                try {
                    await window.aistudio.openSelectKey();
                    setApiKeyReady(true);
                    setTimeout(() => handleStartConnection(), 500);
                } catch (e) {
                    setToastMessage("Bạn cần chọn API Key.");
                    setIsSettingsOpen(true);
                }
                return;
            }
            setToastMessage("Chưa có API Key.");
            setIsSettingsOpen(true);
            return;
        }
        handleStartConnection();
    };

    const handleStartConnection = () => {
        if (!currentSessionId) handleCreateSession();
        processedHistoryLengthRef.current = 0;
        // Note: gemini.connect calls useGeminiLive internally which resets state logic
        gemini.connect();
    };

    const handleSetMode = (newMode: AppMode) => {
        if (gemini.mode === newMode) return;
        gemini.setMode(newMode);
        const modeName = newMode === 'translator' ? "Phiên dịch" : "Trợ lý ảo NaNa";
        setToastMessage(`Đã chuyển sang: ${modeName}`);
        if (gemini.active) gemini.disconnect();
    };

    let currentEmotion = Emotion.NEUTRAL;
    if (gemini.state === EyeState.SPEAKING) currentEmotion = Emotion.HAPPY;
    if (gemini.state === EyeState.THINKING) currentEmotion = Emotion.SURPRISED;

    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const dateDisplay = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentTime);

    const currentSession = sessions.find(s => s.id === currentSessionId);
    const displayMessages = currentSession ? currentSession.messages : [];

    // Updated Auto-scroll logic: Target the end ref instead of container scrollTop
    // This is more reliable for variable height content
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [displayMessages, gemini.liveTranscript, currentSessionId, gemini.active]);

    return (
        // Use 100dvh for mobile browsers to handle address bar dynamically
        <div className="h-[100dvh] w-screen bg-black text-white flex font-sans overflow-hidden select-none">

            <Toast
                message={gemini.error ? (gemini.error.includes('entity was not found') ? "Lỗi Model. Reset Key..." : (toastMessage || gemini.error)) : toastMessage}
                onClose={() => { gemini.clearError(); setToastMessage(null); setToastAction(undefined); }}
                onClick={toastAction}
            />

            {gemini.isDeepSleep && <AODDisplay onWake={() => gemini.setIsDeepSleep(false)} />}

            <VideoPlayer state={gemini.videoState} onClose={() => gemini.setVideoState(prev => ({ ...prev, isOpen: false }))} />

            {/* --- Sidebar (Left) --- */}
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onCreateSession={handleCreateSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onTogglePinSession={handleTogglePinSession}
                onOpenSettings={() => setIsSettingsOpen(true)}
                mode={gemini.mode}
                onSetMode={handleSetMode}
                settings={settings}
                location={location}
            />

            {/* --- Main Content Area --- */}
            <main
                className="flex-1 relative flex flex-col h-full overflow-hidden transition-all duration-300"
                onClick={() => {
                    // Close sidebar if clicking main content on mobile
                    if (window.innerWidth < 1024 && isSidebarOpen) setIsSidebarOpen(false);
                }}
            >

                {/* Mobile Sidebar Toggle - Visible only when sidebar is closed on mobile */}
                <div className={`absolute top-safe-top left-4 z-40 transition-opacity duration-300 mt-2 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsSidebarOpen(true);
                        }}
                        className="p-3 bg-neutral-900/50 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white backdrop-blur-sm border border-neutral-800 touch-manipulation"
                    >
                        <PanelLeftOpen size={24} />
                    </button>
                </div>

                {/* --- DYNAMIC BACKGROUND SYSTEM --- */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                    {/* Top-Left Blob (Primary) */}
                    <div
                        className={`absolute top-[-20%] left-[-10%] w-[70%] h-[70%] blur-[120px] rounded-full mix-blend-screen transition-all duration-700 ease-in-out
                ${gemini.mode === 'translator'
                                ? 'bg-blue-900/20'
                                : (gemini.state === EyeState.THINKING ? 'bg-amber-700/20' : 'bg-purple-900/20')}
                ${gemini.state === EyeState.LISTENING
                                ? 'scale-110 opacity-50'
                                : gemini.state === EyeState.SPEAKING ? 'scale-105 opacity-60 animate-pulse' : 'scale-100 opacity-20'}
                `}
                    />

                    {/* Bottom-Right Blob (Secondary) */}
                    <div
                        className={`absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] blur-[120px] rounded-full mix-blend-screen transition-all duration-700 ease-in-out
                ${gemini.mode === 'translator'
                                ? 'bg-cyan-900/20'
                                : (gemini.state === EyeState.THINKING ? 'bg-orange-700/20' : 'bg-pink-900/20')}
                ${gemini.state === EyeState.SPEAKING
                                ? 'scale-125 opacity-50 animate-pulse'
                                : gemini.state === EyeState.LISTENING ? 'scale-90 opacity-40' : 'scale-100 opacity-20'}
                `}
                        style={{ animationDelay: '1s' }}
                    />

                    {/* Reactive Center Aura (Activity Glow) */}
                    <div
                        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] blur-[80px] rounded-full pointer-events-none transition-all duration-500
                ${gemini.active ? 'opacity-100' : 'opacity-0'}
                `}
                        style={{
                            background: `radial-gradient(circle, ${gemini.state === EyeState.LISTENING ? 'rgba(59, 130, 246, 0.05)' :
                                    gemini.state === EyeState.SPEAKING ? 'rgba(168, 85, 247, 0.08)' :
                                        gemini.state === EyeState.THINKING ? 'rgba(245, 158, 11, 0.05)' : 'transparent'
                                } 0%, transparent 60%)`
                        }}
                    />
                </div>

                {/* Content Container - Switch from column to row only on Large (lg) screens */}
                {/* On Mobile/Vertical Tablet: Flex Col. On Desktop/Landscape Tablet: Flex Row */}
                <div className="flex-1 flex flex-col lg:flex-row items-center justify-center w-full max-w-7xl mx-auto lg:px-6 relative z-10 h-full pb-safe-bottom">

                    {/* 1. LEFT / TOP: NaNa Avatar */}
                    {/* Mobile: Takes 30% height (reduced from 40%). Desktop: Takes 50% width, full height */}
                    <div className={`flex flex-col items-center justify-center w-full relative group transition-all duration-1000 
                ${gemini.active
                            ? 'h-[25vh] min-h-[200px] lg:h-full lg:w-1/2 lg:-translate-x-10 shrink-0' // Active layout: Smaller height on mobile
                            : 'h-full lg:w-full' // Idle layout
                        }
            `}>
                        <div
                            className={`relative transition-all duration-700 hover:scale-105 cursor-pointer flex items-center justify-center
                        ${gemini.active ? 'scale-[0.55] md:scale-90 lg:scale-100' : 'scale-90 md:scale-100 lg:scale-125'}
                    `}
                            onClick={handleMainAction}
                        >
                            {/* Aura Layers */}
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full blur-[80px] -z-20 transition-all duration-1000 ${gemini.mode === 'translator' ? 'bg-blue-600/20' : 'bg-purple-600/20'} ${gemini.state === EyeState.LISTENING ? 'scale-110 opacity-60' : 'scale-100 opacity-30'}`} />
                            <div
                                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] md:w-[320px] md:h-[320px] rounded-full blur-[50px] -z-10 transition-all duration-1000 ease-in-out animate-pulse-slow ${gemini.mode === 'translator' ? 'bg-gradient-to-tr from-blue-700 via-cyan-600 to-teal-500' : 'bg-gradient-to-tr from-purple-700 via-fuchsia-600 to-pink-500'} ${gemini.state === EyeState.LISTENING ? 'scale-105 opacity-80' : gemini.state === EyeState.SPEAKING ? 'scale-110 opacity-90' : 'scale-95 opacity-50'}`}
                                style={{ boxShadow: gemini.mode === 'translator' ? '0 0 60px rgba(6,182,212,0.3)' : '0 0 60px rgba(192,38,211,0.3)' }}
                            />

                            {/* Face */}
                            <div className="relative z-10 flex flex-col items-center justify-center">
                                <Eyes state={gemini.state} emotion={currentEmotion} volume={gemini.active ? gemini.volume : 0} />
                                <div className={`transition-opacity duration-300 ${gemini.state === EyeState.SPEAKING ? 'opacity-100' : 'opacity-30'}`}>
                                    <Mouth eyeState={gemini.state} emotion={currentEmotion} volume={gemini.active ? gemini.volume : 0} />
                                </div>
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className={`mt-2 md:mt-16 text-center h-8 z-10 ${gemini.active ? '' : 'absolute bottom-20'}`}>
                            {gemini.active ? (
                                <div className={`flex items-center gap-2 justify-center px-4 py-1 rounded-full border bg-black/50 backdrop-blur-sm ${gemini.mode === 'translator' ? 'border-blue-500/30 text-blue-300' : 'border-purple-500/30 text-purple-300'}`}>
                                    <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                                    <p className="text-xs tracking-[0.2em] uppercase">
                                        {gemini.state === EyeState.LISTENING ? "Listening..." : gemini.state === EyeState.SPEAKING ? "Speaking..." : "Active"}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-neutral-600 text-sm tracking-[0.3em] uppercase">Offline</p>
                            )}
                        </div>
                    </div>

                    {/* 2. RIGHT / BOTTOM: Info, Clock & Chat */}
                    {/* Mobile: Fills remaining height. Desktop: 50% width, full height. */}
                    <div className={`flex flex-col relative transition-all duration-500 
                ${gemini.active
                            ? 'flex-1 w-full lg:h-full lg:w-1/2 lg:pl-0'
                            : 'hidden lg:flex lg:flex-1 items-center justify-center' // On mobile idle, hide this part to center Avatar
                        }
            `}>

                        {/* Animated Clock */}
                        {/* Updated: Uses safe area for positioning. Fixed at top right. */}
                        <div
                            className={`transition-all duration-1000 ease-in-out z-20 flex flex-col items-center select-none pointer-events-none
                    ${gemini.active
                                    ? 'fixed top-safe-top right-4 origin-top-right scale-[0.3] md:scale-[0.4] lg:scale-[0.45] bg-black/40 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl mt-2'
                                    : 'w-full relative scale-100 origin-center'
                                }`}
                        >
                            <div className="font-bold tracking-tighter leading-none flex items-center justify-center">
                                <span className={`text-7xl md:text-9xl lg:text-[140px] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(192,132,252,0.3)] transition-all duration-1000 ${gemini.mode === 'translator' ? 'bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400' : 'bg-gradient-to-br from-purple-400 via-fuchsia-400 to-pink-400'}`}>
                                    {hours}
                                </span>
                                <span className="text-5xl md:text-8xl lg:text-[120px] text-neutral-800 px-1 lg:px-3 -mt-2 lg:-mt-8 animate-pulse">:</span>
                                <span className={`text-7xl md:text-9xl lg:text-[140px] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,114,182,0.3)] transition-all duration-1000 ${gemini.mode === 'translator' ? 'bg-gradient-to-bl from-teal-400 via-blue-400 to-indigo-400' : 'bg-gradient-to-bl from-pink-400 via-purple-400 to-indigo-400'}`}>
                                    {minutes}
                                </span>
                            </div>

                            <div className={`text-neutral-400 font-light mt-0 capitalize transition-all duration-1000 text-center ${gemini.active ? 'text-4xl mt-2' : 'text-2xl lg:text-3xl'}`}>
                                {dateDisplay}
                            </div>

                            <div className={`text-neutral-600 text-sm lg:text-base font-medium mt-2 lg:mt-4 tracking-wide ${gemini.active ? 'hidden' : 'block'}`}>
                                {apiKeyReady ? "Sẵn sàng kết nối" : "Chưa có API Key"}
                            </div>
                        </div>

                        {/* --- CHAT INTERFACE --- */}
                        {gemini.active ? (
                            <div
                                className="flex-1 w-full mt-4 lg:mt-32 pb-40 lg:pb-0 overflow-y-auto px-4 custom-scrollbar space-y-3 lg:space-y-4 animate-in fade-in slide-in-from-bottom-10 duration-700 relative"
                                ref={chatContainerRef}
                            >
                                {/* Top Fade Gradient to prevent text crashing into clock on mobile */}
                                <div className="sticky top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent z-10 pointer-events-none" />

                                {/* Empty State */}
                                {displayMessages.length === 0 && !gemini.liveTranscript && (
                                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-50">
                                        <Sparkles size={24} />
                                        <p className="text-xs lg:text-sm mt-2">
                                            {currentSessionId ? "Bắt đầu trò chuyện..." : "Đang tạo phiên..."}
                                        </p>
                                    </div>
                                )}

                                {/* Messages */}
                                {displayMessages.map((msg, index) => (
                                    <div key={index} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex max-w-[90%] lg:max-w-[85%] flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`relative px-4 py-2.5 lg:px-5 lg:py-3 rounded-2xl text-sm lg:text-base leading-relaxed shadow-lg break-words ${msg.role === 'user' ? 'bg-gradient-to-br from-neutral-800 to-neutral-700 text-white rounded-tr-sm' : (gemini.mode === 'translator' ? 'bg-blue-900/30 border border-blue-800/50 text-blue-100 rounded-tl-sm' : 'bg-purple-900/30 border border-purple-800/50 text-purple-100 rounded-tl-sm')}`}>
                                                {msg.text}
                                            </div>
                                            {msg.role === 'model' && msg.originalText && (
                                                <div className="mt-1 pt-1 border-t border-white/10 text-[10px] lg:text-xs text-neutral-400 flex flex-col gap-0.5 px-2">
                                                    <span className="uppercase tracking-wider opacity-70">Original</span>
                                                    <span className="italic">"{msg.originalText}"</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Live Transcript */}
                                {gemini.liveTranscript && (
                                    <div className={`flex w-full ${gemini.liveTranscript.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`flex max-w-[90%] lg:max-w-[85%] flex-col ${gemini.liveTranscript.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div className={`relative px-4 py-2.5 lg:px-5 lg:py-3 rounded-2xl text-sm lg:text-base leading-relaxed shadow-lg opacity-70 animate-pulse break-words ${gemini.liveTranscript.role === 'user' ? 'bg-neutral-800 text-neutral-300 rounded-tr-sm' : 'bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-tl-sm'}`}>
                                                {gemini.liveTranscript.text}...
                                            </div>
                                            {gemini.liveTranscript.role === 'model' && gemini.liveTranscript.originalText && (
                                                <div className="mt-1 pt-1 border-t border-white/10 text-[10px] lg:text-xs text-neutral-500 italic px-2">
                                                    (Original: "{gemini.liveTranscript.originalText}")
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Scroll Anchor */}
                                <div ref={messagesEndRef} className="h-4" />
                            </div>
                        ) : (
                            <div className="hidden lg:flex w-full max-w-lg min-h-[120px] items-center justify-center relative mt-8 text-center">
                                <p className="text-2xl font-serif italic text-neutral-600 leading-relaxed transition-opacity duration-1000">"{quote}"</p>
                            </div>
                        )}

                        {/* Control Pill - Fixed at bottom of chat container with Safe Area support */}
                        <div className={`${gemini.active ? 'absolute bottom-6 pb-safe-bottom left-0 right-0 flex justify-center z-20 pointer-events-none' : ''}`}>
                            <button
                                onClick={handleMainAction}
                                className={`pointer-events-auto group relative flex items-center gap-4 pl-4 pr-6 py-3 lg:py-4 rounded-full transition-all duration-500 border shadow-2xl ${gemini.active ? 'bg-neutral-900 border-neutral-800 hover:bg-red-900/20 hover:border-red-800/50 scale-95 hover:scale-100' : apiKeyReady ? 'bg-white text-black hover:scale-105 border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border-neutral-700 animate-pulse'}`}
                            >
                                <div className={`w-3 h-3 rounded-full ${gemini.active ? 'bg-red-500 animate-pulse' : (apiKeyReady ? 'bg-black' : 'bg-yellow-500')}`}></div>
                                <span className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                                    {!apiKeyReady && <Key size={14} />}
                                    {gemini.active ? "Stop Session" : (apiKeyReady ? (gemini.mode === 'translator' ? "Start Translator" : "Start NaNa") : "Enter API Key")}
                                </span>
                            </button>
                        </div>

                    </div>

                </div>
            </main>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                settings={settings}
                onSave={handleSaveSettings}
            />
        </div>
    );
};

export default App;
