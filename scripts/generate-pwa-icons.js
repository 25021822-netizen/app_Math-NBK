import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// CRC32 table for PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, renderPixel) {
  // 8-byte PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk: 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Raw image data: height rows, each starts with filter byte 0 followed by width * 4 bytes RGBA
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = renderPixel(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // Deflate compressed IDAT
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

// Beautiful icon renderer: Rounded rectangle with royal blue gradient, math & AI brand mark
function renderAppIcon(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const normX = x / w;
  const normY = y / h;

  // Background gradient: Rich Blue (#1e40af) to Deep Indigo (#312e81) with cyan highlights
  let r = Math.round(30 + normY * 15 + normX * 10);
  let g = Math.round(64 + (1 - normY) * 70);
  let b = Math.round(180 + normY * 50);
  let a = 255;

  // If not maskable, round the corners (smooth squircle / rounded rect)
  if (!isMaskable) {
    const radius = w * 0.22;
    const dx = Math.abs(x - cx) - (cx - radius);
    const dy = Math.abs(y - cy) - (cy - radius);
    if (dx > 0 && dy > 0) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        return [0, 0, 0, 0]; // Transparent outside rounded corner
      } else if (dist > radius - 1) {
        a = Math.round((radius - dist) * 255);
      }
    }
  }

  // Inner subtle glowing circle
  const distCenter = Math.hypot(x - cx, y - cy) / (w * 0.5);
  if (distCenter < 0.8) {
    const glow = (1 - distCenter) * 45;
    r = Math.min(255, r + glow * 0.6);
    g = Math.min(255, g + glow * 0.8);
    b = Math.min(255, b + glow);
  }

  // Draw central emblem: Stylized Math & AI Symbol
  // Coordinates relative to center, normalized -1 to 1
  const scale = isMaskable ? 0.65 : 0.8; // Maskable has extra safe zone padding
  const nx = (x - cx) / (cx * scale);
  const ny = (y - cy) / (cy * scale);

  // Golden / White Accent: Sigma & Infinity loop inspired curves
  // 1. Horizontal top bar of Sigma / Math bar
  if (Math.abs(ny - (-0.45)) < 0.08 && nx > -0.55 && nx < 0.55) {
    return [255, 255, 255, a];
  }
  // 2. Horizontal bottom bar
  if (Math.abs(ny - 0.45) < 0.08 && nx > -0.55 && nx < 0.55) {
    return [255, 255, 255, a];
  }
  // 3. Diagonal upper chevron to center
  const diag1 = Math.abs((ny - (-0.45)) - (nx - (-0.5)) * 0.9);
  if (diag1 < 0.08 && nx >= -0.5 && nx <= 0.05 && ny >= -0.45 && ny <= 0.05) {
    return [255, 255, 255, a];
  }
  // 4. Diagonal lower chevron from center
  const diag2 = Math.abs((ny - 0.0) - ((-0.5) - nx) * 0.9);
  if (diag2 < 0.08 && nx >= -0.5 && nx <= 0.05 && ny >= -0.05 && ny <= 0.45) {
    return [255, 255, 255, a];
  }

  // 5. Sparkling AI Star at upper right (Golden Amber / Cyan sparkle)
  const starDist = Math.hypot(nx - 0.35, ny - (-0.15));
  if (starDist < 0.2) {
    const starAngle = Math.atan2(ny - (-0.15), nx - 0.35);
    const starR = 0.07 + 0.1 * Math.pow(Math.cos(starAngle * 2), 4);
    if (starDist < starR) {
      return [253, 224, 71, a]; // Gold AI star
    }
  }

  // 6. Dot / Sparkle at bottom right
  const dotDist = Math.hypot(nx - 0.35, ny - 0.25);
  if (dotDist < 0.09) {
    return [56, 189, 248, a]; // Sky blue accent dot
  }

  return [Math.round(r), Math.round(g), Math.round(b), Math.round(a)];
}

// Generate the icons
console.log('Generating PWA icons...');

fs.writeFileSync(
  path.join(publicDir, 'pwa-192x192.png'),
  createPng(192, 192, (x, y, w, h) => renderAppIcon(x, y, w, h, false))
);

fs.writeFileSync(
  path.join(publicDir, 'pwa-512x512.png'),
  createPng(512, 512, (x, y, w, h) => renderAppIcon(x, y, w, h, false))
);

fs.writeFileSync(
  path.join(publicDir, 'pwa-maskable-512x512.png'),
  createPng(512, 512, (x, y, w, h) => renderAppIcon(x, y, w, h, true))
);

fs.writeFileSync(
  path.join(publicDir, 'apple-touch-icon.png'),
  createPng(180, 180, (x, y, w, h) => renderAppIcon(x, y, w, h, false))
);

// Also write beautiful SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047" />
      <stop offset="100%" stop-color="#eab308" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  <circle cx="256" cy="256" r="210" fill="none" stroke="#60a5fa" stroke-width="2" stroke-dasharray="8 8" opacity="0.3" />
  <!-- Math Sigma Symbol -->
  <path d="M 160 150 L 320 150 L 320 180 L 230 180 L 275 256 L 230 332 L 320 332 L 320 362 L 160 362 L 225 256 Z" fill="#ffffff" filter="url(#glow)" />
  <!-- AI Sparkle Star -->
  <path d="M 370 200 Q 370 230 400 230 Q 370 230 370 260 Q 370 230 340 230 Q 370 230 370 200 Z" fill="url(#gold)" filter="url(#glow)" />
  <circle cx="370" cy="300" r="16" fill="#38bdf8" />
  <!-- Brand text -->
  <text x="256" y="440" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">TOÁN THẦY KỲ</text>
  <text x="256" y="475" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" fill="#93c5fd" text-anchor="middle" letter-spacing="2">LIKI AI STUDIO</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(64, 64, (x, y, w, h) => renderAppIcon(x, y, w, h, false)));

console.log('Successfully generated all PWA icons in /public!');
