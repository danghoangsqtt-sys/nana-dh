
import React, { useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Play, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { playPCMAudio } from '../utils/audioUtils';

interface GeminiTTSProps {
  text: string;
}

const GeminiTTS: React.FC<GeminiTTSProps> = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlay = async () => {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      setError("API Key not found.");
      return;
    }
    if (!text) {
      setError("Không có nội dung.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: {
          parts: [{ text: text }] 
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        throw new Error("No audio content generated.");
      }

      const audioPart = parts.find((p: any) => p.inlineData);
      
      if (audioPart && audioPart.inlineData && audioPart.inlineData.data) {
        setIsPlaying(true);
        // playPCMAudio trong utils mới sẽ tự tạo temporary context
        await playPCMAudio(audioPart.inlineData.data);
        setIsPlaying(false);
      } else {
        throw new Error("Audio data not found in response.");
      }

    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      setError(err.message || "Lỗi khi gọi API.");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-neutral-800/50 rounded-xl border border-neutral-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-400">
          <Volume2 size={18} />
          <span className="text-sm font-semibold">Gemini Voice (Kore)</span>
        </div>
        {error && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-400 italic truncate max-w-full">
        "{text}"
      </p>

      <button
        onClick={handlePlay}
        disabled={isLoading || isPlaying}
        className={`mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
          isPlaying 
            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50' 
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isPlaying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Đang phát...</span>
          </>
        ) : (
          <>
            <Play size={16} fill="currentColor" />
            <span>Phát thử Audio</span>
          </>
        )}
      </button>
    </div>
  );
};

export default GeminiTTS;
