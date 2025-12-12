// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.API_KEY),
      'process.env': {}
    },
    // Thêm phần cấu hình build dưới đây
    build: {
      chunkSizeWarningLimit: 1000, // (Tùy chọn) Tăng giới hạn cảnh báo lên 1000kB nếu muốn
      rollupOptions: {
        output: {
          manualChunks: {
            // Tách riêng các thư viện lớn ra khỏi file chính
            'vendor-react': ['react', 'react-dom'],
            'vendor-framer': ['framer-motion'],
            'vendor-genai': ['@google/genai'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    }
  }
})