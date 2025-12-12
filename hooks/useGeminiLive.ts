
import { useEffect, useRef, useState, useCallback } from 'react';
import { LiveService } from '../services/liveService';
import { EyeState, UserSettings, VideoState, UserLocation, ChatMessage, AppMode } from '../types';

export const useGeminiLive = (settings: UserSettings, location: UserLocation | null, onOpenSettings?: () => void) => {
  const [state, setState] = useState<EyeState>(EyeState.IDLE);
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [videoState, setVideoState] = useState<VideoState>({ isOpen: false, type: null, url: '', title: '' });
  const [isDeepSleep, setIsDeepSleep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // App Mode (Assistant vs Translator)
  const [mode, setMode] = useState<AppMode>('assistant');

  // Chat History & Live Transcript
  const [history, setHistory] = useState<ChatMessage[]>([]);
  
  // Extended type for live transcript to include verification text
  const [liveTranscript, setLiveTranscript] = useState<{ text: string; role: 'user' | 'model'; originalText?: string } | null>(null);

  // Keep track of the last user text (accumulated) to pair with translation
  const lastUserTextRef = useRef<string>("");

  const serviceRef = useRef<LiveService | null>(null);

  // Ref to hold the latest callback to avoid unnecessary reconnections
  const onOpenSettingsRef = useRef(onOpenSettings);
  useEffect(() => {
      onOpenSettingsRef.current = onOpenSettings;
  }, [onOpenSettings]);

  const connect = useCallback(() => {
    // Determine effective API Key
    const effectiveApiKey = settings.apiKey || process.env.API_KEY;

    if (!effectiveApiKey) {
        setError("Thiếu API Key. Vui lòng kiểm tra Cài đặt.");
        return;
    }

    if (serviceRef.current) {
        serviceRef.current.disconnect();
    }

    const service = new LiveService(effectiveApiKey);
    
    service.onStateChange = (s) => setState(s);
    service.onVolumeChange = (v) => setVolume(v);
    service.onVideoCommand = (v) => setVideoState(v);
    service.onDeepSleepCommand = () => setIsDeepSleep(true);
    service.onOpenSettingsCommand = () => {
        if (onOpenSettingsRef.current) onOpenSettingsRef.current();
    };
    service.onError = (msg) => setError(msg);
    
    service.onDisconnect = () => {
        serviceRef.current = null;
        setIsActive(false);
        setState(EyeState.IDLE);
    };

    // Handle Transcription updates
    service.onTranscript = (text, isUser, isFinal) => {
        const role = isUser ? 'user' : 'model';
        
        // Update user text buffer continuously (so it's ready when model replies in real-time)
        if (isUser) {
            lastUserTextRef.current = text;
        }

        // Logic for Translator Mode: Attach original text to Model output
        let verificationText: string | undefined = undefined;
        if (!isUser && mode === 'translator' && lastUserTextRef.current) {
            verificationText = lastUserTextRef.current;
        }
        
        // Update live subtitles
        setLiveTranscript({ 
            text, 
            role, 
            originalText: verificationText 
        });

        // If finalized, push to history
        if (isFinal && text.trim().length > 0) {
            setHistory(prev => {
                // Avoid duplicates if rapid firing happens
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === role && lastMsg.text === text) return prev;
                
                return [...prev, {
                    role,
                    text,
                    originalText: verificationText,
                    timestamp: Date.now()
                }];
            });
            // Clear live transcript after a short delay
            setTimeout(() => {
                setLiveTranscript(current => current?.text === text ? null : current);
            }, 2000);
        }
    };
    
    // Pass location and current mode to connect
    service.connect(settings, location, mode);
    serviceRef.current = service;
    setIsActive(true);
  }, [settings, location, mode]); 

  const disconnect = useCallback(() => {
    if (serviceRef.current) {
        serviceRef.current.disconnect();
        serviceRef.current = null;
    }
    setState(EyeState.IDLE);
    setIsActive(false);
    setLiveTranscript(null);
    lastUserTextRef.current = ""; // Reset context
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    state,
    volume,
    videoState,
    setVideoState,
    isDeepSleep,
    setIsDeepSleep,
    connect,
    disconnect,
    active: isActive,
    error,
    clearError,
    history,
    liveTranscript,
    clearHistory,
    mode,
    setMode
  };
};
