import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
    base: './',
    build: {  
        outDir: path.resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true
    },
    plugins: [
        electron({
            main: {
                entry: path.resolve(__dirname, 'src/main/main.ts'),
                vite: {
                    build: {
                        outDir: path.resolve(__dirname, 'dist/main')
                    }
                }
            },
            preload: {
                input: path.resolve(__dirname, 'src/main/preload.ts'),
                vite: {
                    build: { 
                        outDir: path.resolve(__dirname, 'dist/main') 
                    }
                }
            }
        })
    ]
});