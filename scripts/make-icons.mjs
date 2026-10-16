// สร้างไอคอน PWA (PNG) โดยไม่ต้องพึ่งไลบรารีภาพ — วาดวงแหวน Gate สีฟ้าบนพื้นมืด
// ใช้: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
const BG = [5, 7, 13];
const BG2 = [14, 26, 58];
const BLUE = [62, 168, 255];
const WHITE = [220, 240, 255];

/** scale < 1 = เว้นขอบสำหรับไอคอน maskable */
function gate(scale) {
  return (u, v) => {
    const dx = (u - 0.5) / scale;
    const dy = (v - 0.5) / scale;
    const d = Math.hypot(dx, dy);
    let c = mix(BG2, BG, d * 1.6);
    // แสงเรือง
    c = mix(c, BLUE, Math.max(0, 0.45 - Math.abs(d - 0.3) * 4));
    // วงแหวน
    if (Math.abs(d - 0.3) < 0.035) c = mix(BLUE, WHITE, 1 - Math.abs(d - 0.3) / 0.035);
    // เพชรตรงกลาง
    const dia = Math.abs(dx) + Math.abs(dy);
    if (dia < 0.12) c = mix(WHITE, BLUE, dia / 0.12);
    return c;
  };
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, gate(1)));
writeFileSync("public/icons/icon-512.png", png(512, gate(1)));
writeFileSync("public/icons/maskable-512.png", png(512, gate(0.75)));
writeFileSync("public/icons/apple-touch-icon.png", png(180, gate(0.9)));
console.log("icons written");
