
import React, { useRef, useEffect, useState } from 'react';
import {
    Settings,
    PanelLeftClose,
    Plus,
    Languages,
    MapPin,
    Sparkles,
    MessageSquare,
    MoreHorizontal,
    Pin,
    Trash2,
    Edit3,
    Check,
    X
} from 'lucide-react';
import { UserSettings, AppMode, UserLocation, ChatSession } from '../types';

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSelectSession: (id: string) => void;
    onCreateSession: () => void;
    onDeleteSession: (id: string, e?: React.MouseEvent) => void;
    onRenameSession: (id: string, newTitle: string) => void;
    onTogglePinSession: (id: string, e?: React.MouseEvent) => void;
    onOpenSettings: () => void;
    mode: AppMode;
    onSetMode: (mode: AppMode) => void; // Changed from onToggleMode
    settings: UserSettings;
    location: UserLocation | null;
}

const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    toggleSidebar,
    sessions,
    currentSessionId,
    onSelectSession,
    onCreateSession,
    onDeleteSession,
    onRenameSession,
    onTogglePinSession,
    onOpenSettings,
    mode,
    onSetMode,
    settings,
    location
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const editInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpenId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input when editing starts
    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editingId]);

    const startEditing = (session: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpenId(null);
        setEditingId(session.id);
        setEditTitle(session.title);
    };

    const saveTitle = (id: string) => {
        if (editTitle.trim()) {
            onRenameSession(id, editTitle.trim());
        }
        setEditingId(null);
    };

    const pinnedSessions = sessions.filter(s => s.isPinned);
    const recentSessions = sessions.filter(s => !s.isPinned).sort((a, b) => b.updatedAt - a.updatedAt);

    const SessionItem: React.FC<{ session: ChatSession }> = ({ session }) => {
        const isActive = currentSessionId === session.id;
        const isMenuOpen = menuOpenId === session.id;
        const isEditing = editingId === session.id;

        return (
            <div
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'}`}
                onClick={() => onSelectSession(session.id)}
            >
                <MessageSquare size={16} className={isActive ? 'text-purple-400' : 'opacity-70'} />

                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                                ref={editInputRef}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveTitle(session.id);
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="w-full bg-neutral-900 border border-neutral-600 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            />
                            <button onClick={() => saveTitle(session.id)} className="p-1 hover:text-green-400"><Check size={12} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 hover:text-red-400"><X size={12} /></button>
                        </div>
                    ) : (
                        <div className="truncate text-sm font-medium pr-6">{session.title}</div>
                    )}
                </div>

                {/* Pin Icon Indicator (Always visible if pinned) */}
                {!isEditing && session.isPinned && (
                    <Pin size={12} className="text-neutral-500 rotate-45" />
                )}

                {/* Hover Menu Trigger */}
                {!isEditing && (
                    <div className={`absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity ${isMenuOpen ? 'opacity-100' : ''}`}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(isMenuOpen ? null : session.id);
                            }}
                            className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                        >
                            <MoreHorizontal size={14} />
                        </button>

                        {/* Context Menu Dropdown */}
                        {isMenuOpen && (
                            <div ref={menuRef} className="absolute right-0 top-8 w-40 bg-[#2b2b2b] border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col py-1">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePinSession(session.id);
                                        setMenuOpenId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 w-full text-left"
                                >
                                    <Pin size={12} className={session.isPinned ? "fill-white" : ""} />
                                    {session.isPinned ? "Bỏ ghim" : "Ghim"}
                                </button>
                                <button
                                    onClick={(e) => startEditing(session, e)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-700 w-full text-left"
                                >
                                    <Edit3 size={12} /> Đổi tên
                                </button>
                                <div className="h-px bg-neutral-700 my-1"></div>
                                <button
                                    onClick={(e) => {
                                        onDeleteSession(session.id, e);
                                        setMenuOpenId(null);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/20 w-full text-left"
                                >
                                    <Trash2 size={12} /> Xóa
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside
            className={`
        fixed lg:relative z-50 h-full bg-[#1e1e1e] border-r border-neutral-800 transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none overflow-hidden
        ${isOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'}
      `}
        >
            {/* 
        CRITICAL FIX for Animation Split:
        The inner container MUST have a fixed width (min-w-[18rem] / w-72).
        This ensures that when the outer 'aside' shrinks, the inner content DOES NOT reflow or squish.
        It just gets clipped by overflow-hidden. This keeps the header and footer completely synchronized.
      */}
            <div className="w-72 min-w-[18rem] h-full flex flex-col bg-[#1e1e1e]">

                {/* --- Header --- */}
                <div className="p-3 flex items-center justify-between shrink-0">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-neutral-700/50 rounded-full text-neutral-400 transition-colors"
                        title="Đóng menu"
                    >
                        <PanelLeftClose size={20} />
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={onCreateSession}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-full text-neutral-300 transition-colors"
                        title="Chat mới"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* --- Mode Selector (Split into 2 buttons) --- */}
                <div className="px-3 pb-4 pt-1 shrink-0">
                    <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2 pl-1">
                        Chế độ hoạt động
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => onSetMode('assistant')}
                            className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border transition-all duration-200 ${mode === 'assistant'
                                    ? 'bg-purple-900/30 border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                    : 'bg-neutral-800/40 border-neutral-700/50 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                                }`}
                        >
                            <Sparkles size={18} className={mode === 'assistant' ? 'text-purple-400' : ''} />
                            <span className="text-xs font-medium">Trợ lý ảo</span>
                        </button>

                        <button
                            onClick={() => onSetMode('translator')}
                            className={`flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border transition-all duration-200 ${mode === 'translator'
                                    ? 'bg-blue-900/30 border-blue-500/50 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                                    : 'bg-neutral-800/40 border-neutral-700/50 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
                                }`}
                        >
                            <Languages size={18} className={mode === 'translator' ? 'text-blue-400' : ''} />
                            <span className="text-xs font-medium">Phiên dịch</span>
                        </button>
                    </div>
                </div>

                {/* --- Session List --- */}
                <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar min-h-0">

                    {/* Pinned Sessions */}
                    {pinnedSessions.length > 0 && (
                        <div className="mb-4">
                            <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Đã ghim</div>
                            <div className="space-y-0.5">
                                {pinnedSessions.map(session => (
                                    <SessionItem key={session.id} session={session} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Sessions */}
                    <div className="mb-2">
                        <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Gần đây</div>
                        {recentSessions.length === 0 ? (
                            <div className="px-3 py-4 text-center">
                                <p className="text-xs text-neutral-600 italic">Chưa có cuộc trò chuyện nào</p>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {recentSessions.map(session => (
                                    <SessionItem key={session.id} session={session} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Footer Controls --- */}
                <div className="p-3 border-t border-neutral-800 bg-[#1e1e1e] space-y-1 shrink-0">
                    <div className="flex items-center gap-2 px-2 py-2 text-xs text-neutral-500">
                        <MapPin size={12} className={location ? "text-green-500" : "text-neutral-600"} />
                        <span className="truncate max-w-[160px]">
                            {location ? `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}` : "Đang định vị..."}
                        </span>
                    </div>

                    <button
                        onClick={onOpenSettings}
                        className="w-full flex items-center gap-3 px-2 py-2 hover:bg-neutral-800 rounded-lg text-sm text-neutral-300 transition-colors"
                    >
                        <Settings size={16} />
                        <span>Cài đặt</span>
                    </button>

                    <div className="px-2 pt-1 flex items-center justify-between text-[10px] text-neutral-600">
                        <span className="truncate max-w-[100px]">{settings.userName}</span>
                    </div>
                </div>

            </div>
        </aside>
    );
};

export default Sidebar;
