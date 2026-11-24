import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function oklchToSrgbCss(lRaw: string, cRaw: string, hRaw: string, aRaw?: string): string {
  const parseUnitOrPercent = (v: string, percentScale = 1): number => {
    if (!v || v === 'none') return 0;
    if (v.endsWith('%')) return (parseFloat(v) / 100) * percentScale;
    return parseFloat(v);
  };

  const L = parseUnitOrPercent(lRaw, 1);
  const C = parseUnitOrPercent(cRaw, 0.4);
  let hDeg = 0;
  if (hRaw && hRaw !== 'none') {
    if (hRaw.endsWith('rad')) hDeg = (parseFloat(hRaw) * 180) / Math.PI;
    else if (hRaw.endsWith('turn')) hDeg = parseFloat(hRaw) * 360;
    else if (hRaw.endsWith('grad')) hDeg = parseFloat(hRaw) * 0.9;
    else hDeg = parseFloat(hRaw);
  }

  const H = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgb = (c: number): number => {
    const clamped = Math.max(0, Math.min(1, c));
    const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(255, v * 255)));
  };

  const r = toSrgb(rLin);
  const g = toSrgb(gLin);
  const bl = toSrgb(bLin);

  if (aRaw !== undefined && aRaw !== '') {
    const alpha = Math.max(0, Math.min(1, parseUnitOrPercent(aRaw, 1)));
    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${bl}, ${Number(alpha.toFixed(4))})`;
    }
  }
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

function transformCssForLegacyBrowsers(css: string): string {
  if (!css || (!css.includes('oklch(') && !css.includes(' in ok'))) {
    return css;
  }

  let out = css.replace(
    /oklch\(\s*(none|[+-]?(?:\d+\.?\d*|\.\d+)%?)\s+(none|[+-]?(?:\d+\.?\d*|\.\d+)%?)\s+(none|[+-]?(?:\d+\.?\d*|\.\d+)(?:deg|rad|turn|grad)?)(?:\s*\/\s*(none|[+-]?(?:\d+\.?\d*|\.\d+)%?))?\s*\)/gi,
    (_m, l, c, h, a) => oklchToSrgbCss(l, c, h, a)
  );

  // Loại bỏ chỉ thị không gian màu "in oklab / in oklch" trong gradient để trình duyệt cũ render đúng dải màu
  out = out.replace(
    /(--tw-gradient-position\s*:[^;{}]*?)\s+in\s+(?:oklab|oklch|lab|lch|srgb(?:-linear)?)\b/gi,
    '$1'
  );
  out = out.replace(
    /((?:linear|radial|conic)-gradient\([^;{}]*?)\s+in\s+(?:oklab|oklch|lab|lch|srgb(?:-linear)?)\b/gi,
    '$1'
  );

  return out;
}

function legacyBrowserCssCompatPlugin(): Plugin {
  return {
    name: 'legacy-browser-css-compat',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('.css') || id.includes('&lang.css')) {
        const transformed = transformCssForLegacyBrowsers(code);
        if (transformed !== code) {
          return {code: transformed, map: null};
        }
      }
      return null;
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'asset' && chunk.fileName.endsWith('.css') && typeof chunk.source === 'string') {
          chunk.source = transformCssForLegacyBrowsers(chunk.source);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      legacyBrowserCssCompatPlugin(),
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

