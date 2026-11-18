import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(
        process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 500,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 40,
              },
              {
                name: 'vendor-firebase-firestore',
                test: /[\\/]node_modules[\\/]@firebase[\\/]firestore[\\/]/,
                priority: 38,
              },
              {
                name: 'vendor-firebase-core',
                test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
                priority: 35,
              },
              {
                name: 'vendor-three-core',
                test: /[\\/]node_modules[\\/]three[\\/]build[\\/]three\.core/,
                priority: 38,
              },
              {
                name: 'vendor-three',
                test: /[\\/]node_modules[\\/]three[\\/]/,
                priority: 35,
              },
              {
                name: 'vendor-katex',
                test: /[\\/]node_modules[\\/]katex[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-jspdf',
                test: /[\\/]node_modules[\\/](jspdf|fflate|fast-png|iobuffer)[\\/]/,
                priority: 32,
              },
              {
                name: 'vendor-html2canvas',
                test: /[\\/]node_modules[\\/](html2canvas|canvg|dompurify|rgbcolor|stackblur-canvas|svg-pathdata)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-xlsx',
                test: /[\\/]node_modules[\\/]xlsx[\\/]/,
                priority: 34,
              },
              {
                name: 'vendor-docx-preview',
                test: /[\\/]node_modules[\\/]docx-preview[\\/]/,
                priority: 33,
              },
              {
                name: 'vendor-docx-export',
                test: /[\\/]node_modules[\\/](docx|xmlbuilder2)[\\/]/,
                priority: 32,
              },
              {
                name: 'vendor-mammoth',
                test: /[\\/]node_modules[\\/](mammoth|bluebird|dingbat-to-unicode|lop|underscore|xml2js|sax)[\\/]/,
                priority: 31,
              },
              {
                name: 'vendor-jszip',
                test: /[\\/]node_modules[\\/](jszip|pako|lie|immediate)[\\/]/,
                priority: 30,
              },
              {
                name: 'vendor-ui',
                test: /[\\/]node_modules[\\/](lucide-react|motion|framer-motion)[\\/]/,
                priority: 25,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

