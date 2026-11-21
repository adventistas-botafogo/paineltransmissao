// Gera um PNG de QR code (preto sobre branco, sem margem) sem dependências externas.
// Uso: node gerar-qr-png.mjs "<texto ou link>" saida.png [pixels-por-modulo=10]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const qrcode = require("../html/lib/qrcode-generator.js");

const [texto, saida, escalaArg] = process.argv.slice(2);
if (!texto || !saida) { console.error('Uso: node gerar-qr-png.mjs "<link>" saida.png [px-por-modulo]'); process.exit(1); }
const escala = Number(escalaArg) || 10;

qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
const qr = qrcode(0, "M");          // versão automática, correção de erro média
qr.addData(texto);
qr.make();
const n = qr.getModuleCount();
const lado = n * escala;

// PNG em tons de cinza, 8 bits
const linhas = Buffer.alloc((lado + 1) * lado);
for (let y = 0; y < lado; y++) {
  linhas[y * (lado + 1)] = 0; // filtro "none"
  for (let x = 0; x < lado; x++) {
    linhas[y * (lado + 1) + 1 + x] = qr.isDark(Math.floor(y / escala), Math.floor(x / escala)) ? 0 : 255;
  }
}
const crcTab = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTab[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const bloco = (tipo, dados) => {
  const t = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
  return Buffer.concat([len, t, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

writeFileSync(saida, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  bloco("IHDR", ihdr),
  bloco("IDAT", deflateSync(linhas)),
  bloco("IEND", Buffer.alloc(0)),
]));
console.log(`${saida}  (${n}×${n} módulos, ${lado}×${lado}px)`);
