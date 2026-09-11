import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 版本小印章（2026.9 杂修）：构建那一刻的北京时间被烙进代码，
// 小屋页角落展示，用来分辨手机 PWA 有没有吃到新部署。
const beijing = new Date(Date.now() + 8 * 3600 * 1000)
const pad = (n) => String(n).padStart(2, '0')
const BUILD_TIME = `${beijing.getUTCFullYear()}.${pad(beijing.getUTCMonth() + 1)}.${pad(beijing.getUTCDate())} ${pad(beijing.getUTCHours())}:${pad(beijing.getUTCMinutes())}`

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME)
  },
  // 三扇门（2026.9 图标批次）：同一座小屋的三个入口页，各挂各的桌面图标。
  // 主门 / = 金月；/moon-silver.html = 银月；/moon-white.html = 白月。
  // vercel.json 零改动：真实存在的文件会被 Vercel 直接放行，rewrites 只兜不存在的路径。
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        silver: fileURLToPath(new URL('./moon-silver.html', import.meta.url)),
        white: fileURLToPath(new URL('./moon-white.html', import.meta.url))
      }
    }
  },
  server: {
    port: 3000
  }
})
