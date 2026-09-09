import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  server: {
    port: 3000
  }
})
