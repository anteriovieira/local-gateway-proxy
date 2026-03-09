import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    root: path.join(__dirname, 'src/renderer'),
    publicDir: 'public',
    build: {
        outDir: path.join(__dirname, 'dist/renderer'),
        emptyOutDir: true,
        commonjsOptions: {
            transformMixedEsModules: true
        }
    },
    optimizeDeps: {
        include: ['@tanstack/react-virtual']
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer/src')
        }
    },
    server: {
        port: 5173,
    }
})
