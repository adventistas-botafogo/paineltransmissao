// Painel do operador — Adventistas Botafogo
// Sem dependências: só Node 22+. Rode com:  node servidor.mjs
//
//   Painel:   http://localhost:3030            (ou http://<IP-deste-PC>:3030 num tablet/celular da rede interna)
//   Overlays: http://127.0.0.1:3030/overlay/lower-third.html?controle=1   e   .../overlay/qrcode.html?controle=1
//             (são as Fontes de Navegador no OBS; o botão "Instalar no OBS" do painel cria as duas)

import http from "node:http";
import os from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, normalize, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { conectar } from "../obs-cli/obs-ws.mjs";

const PORTA = Number(process.env.PORTA) || 3030;
const VERSAO = (() => {
  try { return JSON.parse(readFileSync(new URL("../versao.json", import.meta.url), "utf8")).versao; } catch { return "?"; }
})();
const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA_OVERLAY = resolve(AQUI, "..", "html");
const PASTA_PAINEL = join(AQUI, "publico");
const ARQ_PREDEF = join(AQUI, "dados", "predefinicoes.json");

// Fontes de Navegador que o painel controla (uma por elemento)
const FONTES = [
  { nome: "Overlays Igreja - Nome", url: `http://127.0.0.1:${PORTA}/overlay/lower-third.html?controle=1` },
  { nome: "Overlays Igreja - QR",   url: `http://127.0.0.1:${PORTA}/overlay/qrcode.html?controle=1` },
  { nome: "Overlays Igreja - Engajamento", url: `http://127.0.0.1:${PORTA}/overlay/engajamento.html?controle=1` },
  { nome: "Overlays Igreja - Logo", url: `http://127.0.0.1:${PORTA}/overlay/logo.html?controle=1` },
];

// Logo do canto: PNGs 1920×1080 da pasta overlays OBS/logo (cada arquivo é uma versão)
const PASTA_LOGO = resolve(AQUI, "..", "logo");
function listarLogos() {
  let arquivos = [];
  try { arquivos = readdirSync(PASTA_LOGO).filter((a) => extname(a).toLowerCase() === ".png").sort(); } catch {}
  return arquivos.map((arquivo) => {
    const resto = arquivo.replace(/^OBS - logo canto superior esquerdo/i, "").replace(/1920x1080\.png$/i, "").replace(/\.png$/i, "").trim();
    return { arquivo, titulo: resto ? resto[0].toUpperCase() + resto.slice(1) : "Padrão" };
  });
}

// Chamadas de engajamento: selos em HTML (overlay/engajamento.html), com os textos editáveis no painel.
// O ícone é fixo por chamada; linha1/linha2 podem ser trocadas e ficam salvas em predefinicoes.json.
const CHAMADAS = [
  { id: "inscreva",    titulo: "Inscreva-se",      icone: "inscreva",    linha1: "Inscreva-se no canal", linha2: "e ative o sininho" },
  { id: "oracao",      titulo: "Pedido de oração", icone: "oracao",      linha1: "Pedidos de oração",    linha2: "deixe nos comentários" },
  { id: "compartilhe", titulo: "Compartilhe",      icone: "compartilhe", linha1: "Compartilhe",          linha2: "envie para quem precisa ouvir" },
];
const DURACAO_CHAMADA = 6.1; // segundos (duração das comps)
// textos atuais: o padrão de cada chamada, com o que o operador editou por cima
const chamadasAtuais = () => CHAMADAS.map((c) => ({ ...c, ...(predefinicoes.chamadas?.[c.id] || {}), padrao: { linha1: c.linha1, linha2: c.linha2 } }));

// ---------- estado ----------
const estado = {
  lt: { noAr: false, nome: "", linha: "@adventistasbotafogo", duracao: 0, desde: null },
  qr: { noAr: false, url: "", titulo: "", rodape: "", duracao: 0, desde: null },
  eng: { tocando: null, desde: null, seq: 0, rodizio: { ativo: false, minutos: 10, ids: CHAMADAS.map((c) => c.id), proxima: null, proximaId: null } },
  logo: { noAr: true, arquivo: null },
  obs: { conectado: false, cena: null, fonteNaCena: false, faltando: [], erro: null },
};
// predefinicoes.json é o arquivo "vivo" do PC; o pacote de instalação traz só o
// predefinicoes-inicial.json, então atualizar a pasta nunca apaga as listas de lá.
const ARQ_PREDEF_INICIAL = join(AQUI, "dados", "predefinicoes-inicial.json");
let predefinicoes = existsSync(ARQ_PREDEF) ? JSON.parse(readFileSync(ARQ_PREDEF, "utf8"))
  : existsSync(ARQ_PREDEF_INICIAL) ? JSON.parse(readFileSync(ARQ_PREDEF_INICIAL, "utf8"))
  : { lowerThirds: [{ nome: "Pr. Patrick Duarte", linha: "@adventistasbotafogo" }] };
predefinicoes.qrs ??= [{ titulo: "Siga no Instagram", url: "https://instagram.com/adventistasbotafogo", rodape: "Aponte a câmera" }];
if (predefinicoes.rodizio) {
  estado.eng.rodizio.minutos = predefinicoes.rodizio.minutos || 10;
  estado.eng.rodizio.ids = (predefinicoes.rodizio.ids || []).filter((id) => CHAMADAS.some((c) => c.id === id));
}
// o logo volta como estava (ligado por padrão), mesmo se o painel reiniciar no meio do culto
{
  const logos = listarLogos();
  const salvo = predefinicoes.logo || {};
  estado.logo.noAr = salvo.noAr ?? true;
  estado.logo.arquivo = logos.some((l) => l.arquivo === salvo.arquivo) ? salvo.arquivo : logos[0]?.arquivo || null;
}

// ---------- eventos (SSE) ----------
const clientes = { painel: new Set(), overlay: new Set() };
function enviar(canal, msg) {
  const linha = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of clientes[canal]) res.write(linha);
}
const msgPainel = () => ({ tipo: "estado", estado, predefinicoes, chamadas: chamadasAtuais(), logos: listarLogos(), versao: VERSAO });
const msgOverlayLogo = () => ({ tipo: "logo", ...estado.logo });
const msgOverlayEng = () => {
  const c = chamadasAtuais().find((x) => x.id === estado.eng.tocando);
  return { tipo: "eng", seq: estado.eng.seq, tocando: c ? { id: c.id, icone: c.icone, linha1: c.linha1, linha2: c.linha2 } : null };
};
const msgOverlayLt = () => ({ tipo: "lt", ...estado.lt });
const msgOverlayQr = () => ({ tipo: "qr", ...estado.qr });
const avisarPainel = () => enviar("painel", msgPainel());

// ---------- lower third ----------
let timerSaida = null;
function ltEntrar({ nome, linha, duracao }) {
  clearTimeout(timerSaida);
  estado.lt = {
    noAr: true,
    nome: String(nome || "").trim().slice(0, 120),
    linha: String(linha ?? "").trim().slice(0, 120),
    duracao: Math.max(0, Number(duracao) || 0),
    desde: Date.now(),
  };
  if (estado.lt.duracao) timerSaida = setTimeout(ltSair, estado.lt.duracao * 1000);
  enviar("overlay", msgOverlayLt());
  avisarPainel();
}
function ltSair() {
  clearTimeout(timerSaida);
  if (!estado.lt.noAr) return;
  estado.lt = { ...estado.lt, noAr: false, desde: null };
  enviar("overlay", msgOverlayLt());
  avisarPainel();
}

// ---------- QR code ----------
let timerSaidaQr = null;
function qrEntrar({ url, titulo, rodape, duracao }) {
  clearTimeout(timerSaidaQr);
  estado.qr = {
    noAr: true,
    url: String(url || "").trim().slice(0, 500),
    titulo: String(titulo ?? "").trim().slice(0, 60),
    rodape: String(rodape ?? "").trim().slice(0, 60),
    duracao: Math.max(0, Number(duracao) || 0),
    desde: Date.now(),
  };
  if (estado.qr.duracao) timerSaidaQr = setTimeout(qrSair, estado.qr.duracao * 1000);
  enviar("overlay", msgOverlayQr());
  avisarPainel();
}
function qrSair() {
  clearTimeout(timerSaidaQr);
  if (!estado.qr.noAr) return;
  estado.qr = { ...estado.qr, noAr: false, desde: null };
  enviar("overlay", msgOverlayQr());
  avisarPainel();
}

// ---------- engajamento ----------
let timerFimChamada = null;
function engTocar(id) {
  if (!CHAMADAS.some((c) => c.id === id)) throw new Error("Chamada desconhecida");
  clearTimeout(timerFimChamada);
  Object.assign(estado.eng, { tocando: id, desde: Date.now(), seq: estado.eng.seq + 1 });
  timerFimChamada = setTimeout(() => { Object.assign(estado.eng, { tocando: null, desde: null }); avisarPainel(); }, DURACAO_CHAMADA * 1000);
  enviar("overlay", msgOverlayEng());
  avisarPainel();
}
function engParar() {
  clearTimeout(timerFimChamada);
  if (!estado.eng.tocando) return;
  Object.assign(estado.eng, { tocando: null, desde: null, seq: estado.eng.seq + 1 });
  enviar("overlay", msgOverlayEng());
  avisarPainel();
}

// rodízio: a cada N minutos toca a próxima chamada marcada, em ordem
let timerRodizio = null;
function agendarRodizio() {
  clearTimeout(timerRodizio);
  const r = estado.eng.rodizio;
  if (!r.ativo || !r.ids.length) { Object.assign(r, { proxima: null, proximaId: null }); return; }
  if (!r.ids.includes(r.proximaId)) r.proximaId = r.ids[0];
  r.proxima = Date.now() + r.minutos * 60_000;
  timerRodizio = setTimeout(() => {
    // não atropela uma chamada que o operador acabou de tocar à mão
    if (!estado.eng.tocando) engTocar(r.proximaId);
    const i = r.ids.indexOf(r.proximaId);
    r.proximaId = r.ids[(i + 1) % r.ids.length];
    agendarRodizio();
    avisarPainel();
  }, r.minutos * 60_000);
}
async function configurarRodizio({ ativo, minutos, ids }) {
  const r = estado.eng.rodizio;
  if (minutos !== undefined) r.minutos = Math.min(120, Math.max(1, Number(minutos) || 10));
  if (Array.isArray(ids)) r.ids = CHAMADAS.map((c) => c.id).filter((id) => ids.includes(id));
  if (ativo !== undefined) r.ativo = !!ativo;
  agendarRodizio();
  predefinicoes = { ...predefinicoes, rodizio: { minutos: r.minutos, ids: r.ids } };
  await mkdir(dirname(ARQ_PREDEF), { recursive: true });
  await writeFile(ARQ_PREDEF, JSON.stringify(predefinicoes, null, 2));
  avisarPainel();
}

// ---------- logo ----------
async function configurarLogo({ noAr, arquivo }) {
  if (arquivo !== undefined) {
    if (!listarLogos().some((l) => l.arquivo === arquivo)) throw new Error("Logo não encontrado na pasta");
    estado.logo.arquivo = arquivo;
  }
  if (noAr !== undefined) estado.logo.noAr = !!noAr;
  predefinicoes = { ...predefinicoes, logo: { ...estado.logo } };
  await mkdir(dirname(ARQ_PREDEF), { recursive: true });
  await writeFile(ARQ_PREDEF, JSON.stringify(predefinicoes, null, 2));
  enviar("overlay", msgOverlayLogo());
  avisarPainel();
}

// ---------- OBS ----------
let obs = null;
async function ligarObs() {
  try {
    obs = await conectar({ aoFechar: () => { obs = null; Object.assign(estado.obs, { conectado: false, erro: "Conexão com o OBS caiu" }); avisarPainel(); } });
    Object.assign(estado.obs, { conectado: true, erro: null });
    await recarregarFontes();
    await atualizarObs();
  } catch (e) {
    obs = null;
    if (estado.obs.erro !== e.message || estado.obs.conectado) {
      Object.assign(estado.obs, { conectado: false, erro: e.message });
      avisarPainel();
    }
  }
}
// Na primeira conexão depois que o painel abre, recarrega as fontes de navegador dos overlays no OBS.
// O OBS mantém essas páginas abertas; depois de uma atualização do pacote elas ainda estariam com o código antigo.
let fontesRecarregadas = false;
async function recarregarFontes() {
  if (fontesRecarregadas || !obs) return;
  fontesRecarregadas = true;
  for (const f of FONTES) {
    try { await obs.req("PressInputPropertiesButton", { inputName: f.nome, propertyName: "refreshnocache" }); } catch {}   // fonte ainda não instalada
  }
}
async function atualizarObs() {
  if (!obs) return ligarObs();
  try {
    const cena = (await obs.req("GetCurrentProgramScene")).currentProgramSceneName;
    const { sceneItems } = await obs.req("GetSceneItemList", { sceneName: cena });
    const faltando = FONTES.filter((f) => !sceneItems.some((i) => i.sourceName === f.nome)).map((f) => f.nome);
    const fonteNaCena = faltando.length === 0;
    if (cena !== estado.obs.cena || faltando.join() !== estado.obs.faltando.join()) {
      Object.assign(estado.obs, { cena, fonteNaCena, faltando });
      avisarPainel();
    }
  } catch { /* a queda é tratada em aoFechar */ }
}
setInterval(atualizarObs, 3000);

async function instalarNoObs() {
  if (!obs) throw new Error("OBS não está conectado");
  const cena = (await obs.req("GetCurrentProgramScene")).currentProgramSceneName;
  const { inputs } = await obs.req("GetInputList");
  for (const f of FONTES) {
    const inputSettings = { is_local_file: false, url: f.url, width: 1920, height: 1080, shutdown: false, restart_when_active: false, reroute_audio: false };
    if (inputs.some((i) => i.inputName === f.nome)) {
      await obs.req("SetInputSettings", { inputName: f.nome, inputSettings });
      const { sceneItems } = await obs.req("GetSceneItemList", { sceneName: cena });
      if (!sceneItems.some((i) => i.sourceName === f.nome)) await obs.req("CreateSceneItem", { sceneName: cena, sourceName: f.nome });
    } else {
      await obs.req("CreateInput", { sceneName: cena, inputName: f.nome, inputKind: "browser_source", inputSettings, sceneItemEnabled: true });
    }
  }
  await atualizarObs();
  return cena;
}

// ---------- HTTP ----------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };

async function servirArquivo(res, raiz, rel) {
  const caminho = normalize(join(raiz, decodeURIComponent(rel)));
  if (!caminho.startsWith(raiz + sep) && caminho !== raiz) return responder(res, 403, { erro: "proibido" });
  try {
    const dados = await readFile(caminho);
    res.writeHead(200, { "Content-Type": MIME[extname(caminho)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(dados);
  } catch { responder(res, 404, { erro: "não encontrado" }); }
}
function responder(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 100_000) { req.destroy(); falha(new Error("corpo grande demais")); } });
    req.on("end", () => { try { ok(s ? JSON.parse(s) : {}); } catch { falha(new Error("JSON inválido")); } });
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const rota = `${req.method} ${url.pathname}`;
  try {
    if (rota === "GET /eventos") {
      const canal = url.searchParams.get("canal") === "overlay" ? "overlay" : "painel";
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write("retry: 1000\n\n");
      const iniciais = canal === "overlay" ? [msgOverlayLt(), msgOverlayQr(), msgOverlayEng(), msgOverlayLogo()] : [msgPainel()];
      for (const m of iniciais) res.write(`data: ${JSON.stringify(m)}\n\n`);
      clientes[canal].add(res);
      const pulso = setInterval(() => res.write(": pulso\n\n"), 15000);
      req.on("close", () => { clearInterval(pulso); clientes[canal].delete(res); });
      return;
    }
    if (rota === "POST /api/lt") {
      const c = await lerCorpo(req);
      if (c.acao === "entrar") {
        if (!String(c.nome || "").trim()) return responder(res, 400, { erro: "Informe o nome" });
        ltEntrar(c);
      } else ltSair();
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/qr") {
      const c = await lerCorpo(req);
      if (c.acao === "entrar") {
        if (!String(c.url || "").trim()) return responder(res, 400, { erro: "Informe o link do QR" });
        qrEntrar(c);
      } else qrSair();
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/eng") {
      const c = await lerCorpo(req);
      if (c.acao === "tocar") engTocar(c.id); else engParar();
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/eng/textos") {
      // {id, linha1, linha2}; linha1 vazia volta ao texto padrão da chamada
      const c = await lerCorpo(req);
      if (!CHAMADAS.some((x) => x.id === c.id)) return responder(res, 400, { erro: "Chamada desconhecida" });
      const linha1 = String(c.linha1 ?? "").trim().slice(0, 40), linha2 = String(c.linha2 ?? "").trim().slice(0, 50);
      const textos = { ...(predefinicoes.chamadas || {}) };
      if (linha1) textos[c.id] = { linha1, linha2 }; else delete textos[c.id];
      predefinicoes = { ...predefinicoes, chamadas: textos };
      await mkdir(dirname(ARQ_PREDEF), { recursive: true });
      await writeFile(ARQ_PREDEF, JSON.stringify(predefinicoes, null, 2));
      avisarPainel();
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/eng/rodizio") {
      await configurarRodizio(await lerCorpo(req));
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/logo") {
      await configurarLogo(await lerCorpo(req));
      return responder(res, 200, { ok: true });
    }
    // "Esconder tudo" também desliga o rodízio (o operador religa quando quiser).
    // O logo fica: é a marca da transmissão, não um elemento de momento.
    if (rota === "POST /api/esconder-tudo") {
      ltSair(); qrSair(); engParar();
      if (estado.eng.rodizio.ativo) await configurarRodizio({ ativo: false });
      return responder(res, 200, { ok: true });
    }
    if (rota === "PUT /api/predefinicoes") {
      const c = await lerCorpo(req);
      if ((c.lowerThirds !== undefined && !Array.isArray(c.lowerThirds)) || (c.qrs !== undefined && !Array.isArray(c.qrs))) return responder(res, 400, { erro: "formato inválido" });
      if (c.lowerThirds) predefinicoes = { ...predefinicoes, lowerThirds: c.lowerThirds.map((x) => ({ nome: String(x.nome || "").slice(0, 120), linha: String(x.linha ?? "").slice(0, 120) })).filter((x) => x.nome) };
      if (c.qrs) predefinicoes = { ...predefinicoes, qrs: c.qrs.map((x) => ({ titulo: String(x.titulo ?? "").slice(0, 60), url: String(x.url || "").slice(0, 500), rodape: String(x.rodape ?? "").slice(0, 60) })).filter((x) => x.url) };
      await mkdir(dirname(ARQ_PREDEF), { recursive: true });
      await writeFile(ARQ_PREDEF, JSON.stringify(predefinicoes, null, 2));
      avisarPainel();
      return responder(res, 200, { ok: true });
    }
    if (rota === "POST /api/obs/instalar") {
      const cena = await instalarNoObs();
      return responder(res, 200, { ok: true, cena });
    }
    if (req.method === "GET" && url.pathname.startsWith("/overlay/")) return servirArquivo(res, PASTA_OVERLAY, url.pathname.slice("/overlay/".length));
    if (req.method === "GET" && url.pathname.startsWith("/midia/logo/")) return servirArquivo(res, PASTA_LOGO, url.pathname.slice("/midia/logo/".length));
    if (req.method === "GET") return servirArquivo(res, PASTA_PAINEL, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
    responder(res, 404, { erro: "rota desconhecida" });
  } catch (e) {
    responder(res, 500, { erro: e.message });
  }
});

servidor.on("error", (e) => {
  if (e.code !== "EADDRINUSE") throw e;
  console.log(`\n  O painel já está aberto neste PC (porta ${PORTA}). Use http://localhost:${PORTA}\n`);
  process.exit(0);
});
servidor.listen(PORTA, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`\n  Painel do operador — Adventistas Botafogo — versão ${VERSAO}\n`);
  console.log(`  Neste PC:        http://localhost:${PORTA}`);
  for (const ip of ips) console.log(`  Na rede interna: http://${ip}:${PORTA}`);
  console.log("\n  Fontes no OBS:");
  for (const f of FONTES) console.log(`    ${f.nome.padEnd(24)} ${f.url}`);
  console.log("\n  Deixe esta janela aberta durante o culto. Ctrl+C para encerrar.\n");
  ligarObs();
});
