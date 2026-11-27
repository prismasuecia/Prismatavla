import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/Prismatavla/',
  plugins: [react(), {
    name: 'student-page-entry',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const page = bundle['index.html']
      if (page?.type === 'asset') {
        this.emitFile({ type: 'asset', fileName: 'rod/index.html', source: page.source })
      }
    },
  }],
})
