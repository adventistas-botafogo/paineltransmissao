const $ = (id) => document.getElementById(id);
let estado = null;
let pessoas = [];
let links = [];
let chamadas = [];
let conectado = false;

// ---------- comunicação ----------
async function api(url, corpo, metodo = "POST") {
  try {
    const r = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Falhou");
    return j;
  } catch (e) {
    aviso(e.message === "Failed to fetch" ? "Sem conexão com o painel. O servidor está aberto?" : e.message);
    throw e;
  }
}

const eventos = new EventSource("/eventos?canal=painel");
eventos.onopen = () => { conectado = true; render(); };
eventos.onerror = () => { conectado = false; render(); };
eventos.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.tipo !== "estado") return;
  estado = m.estado;
  pessoas = m.predefinicoes.lowerThirds || [];
  links = m.predefinicoes.qrs || [];
  chamadas = m.chamadas || [];
  if (m.versao) { $("versao").textContent = `v${m.versao}`; $("versao").title = `Versão ${m.versao} do painel`; }
  render();
};

// ---------- nome ----------
function mostrar(nome, linha) {
  nome = (nome ?? $("nome").value).trim();
  linha = (linha ?? $("linha").value).trim();
  if (!nome) { $("nome").focus(); return; }
  api("/api/lt", { acao: "entrar", nome, linha, duracao: Number($("duracao").value) });
}
const tirar = () => api("/api/lt", { acao: "sair" });

$("form").addEventListener("submit", (e) => { e.preventDefault(); mostrar(); });
$("btnTirar").onclick = tirar;
$("btnSalvar").onclick = async () => {
  const nome = $("nome").value.trim(), linha = $("linha").value.trim();
  if (!nome) { $("nome").focus(); return; }
  await api("/api/predefinicoes", { lowerThirds: pessoas.filter((p) => p.nome !== nome).concat({ nome, linha }) }, "PUT");
  toast("Salvo na lista");
};

// ---------- QR code ----------
const lerQr = () => ({ url: $("qrUrl").value.trim(), titulo: $("qrTitulo").value.trim(), rodape: $("qrRodape").value.trim() });
const preencherQr = (q) => { $("qrUrl").value = q.url; $("qrTitulo").value = q.titulo; $("qrRodape").value = q.rodape; };
function mostrarQr(q = lerQr()) {
  if (!q.url) { $("qrUrl").focus(); return; }
  api("/api/qr", { acao: "entrar", ...q, duracao: Number($("qrDuracao").value) });
}
$("qrForm").addEventListener("submit", (e) => { e.preventDefault(); mostrarQr(); });
$("qrTirar").onclick = () => api("/api/qr", { acao: "sair" });
$("qrSalvar").onclick = async () => {
  const q = lerQr();
  if (!q.url) { $("qrUrl").focus(); return; }
  await api("/api/predefinicoes", { qrs: links.filter((l) => l.url !== q.url).concat(q) }, "PUT");
  toast("Link salvo na lista");
};

// ---------- engajamento ----------
const rodizio = (mudanca) => api("/api/eng/rodizio", mudanca);
$("rodAtivo").onchange = (e) => rodizio({ ativo: e.target.checked });
$("rodMinutos").onchange = (e) => rodizio({ minutos: Number(e.target.value) });

function desenharChamadas() {
  const eng = estado.eng, r = eng.rodizio;
  const chave = JSON.stringify([chamadas, eng.tocando, r.ids]);
  if (chaves.eng === chave) return;
  chaves.eng = chave;
  $("chamadas").replaceChildren(...chamadas.map((c) => {
    const b = document.createElement("button");
    b.className = "chamada" + (eng.tocando === c.id ? " tocando" : "");
    b.textContent = c.titulo;
    b.onclick = () => api("/api/eng", eng.tocando === c.id ? { acao: "parar" } : { acao: "tocar", id: c.id });
    return b;
  }));
  $("rodIds").replaceChildren(...chamadas.map((c) => {
    const l = document.createElement("label");
    l.className = "marca";
    const cb = Object.assign(document.createElement("input"), { type: "checkbox", checked: r.ids.includes(c.id) });
    cb.onchange = () => rodizio({ ids: chamadas.filter((x) => x.id === c.id ? cb.checked : r.ids.includes(x.id)).map((x) => x.id) });
    l.append(cb, c.titulo);
    return l;
  }));
}

// ---------- geral ----------
$("btnTudo").onclick = () => api("/api/esconder-tudo");
$("btnInstalar").onclick = async () => {
  const r = await api("/api/obs/instalar");
  toast(`Overlays instalados na cena “${r.cena}”`);
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { e.preventDefault(); tirar(); }
});

// ---------- tela ----------
const chaves = {};
function render() {
  setPilula("stServidor", conectado);
  const obsOk = conectado && estado?.obs.conectado;
  setPilula("stObs", obsOk);
  setPilula("stFonte", obsOk && estado.obs.fonteNaCena);
  $("stFonte").title = estado?.obs.cena ? `Cena atual: ${estado.obs.cena}` : "";
  $("btnInstalar").hidden = !(obsOk && !estado.obs.fonteNaCena);

  if (!conectado) aviso("Sem conexão com o servidor do painel. Verifique se a janela “Painel do operador” está aberta no PC da transmissão.");
  else if (estado && !estado.obs.conectado) aviso(`OBS não conectado: ${estado.obs.erro || "aguardando…"}. O painel tenta de novo sozinho.`);
  else if (estado && !estado.obs.fonteNaCena) aviso(`A cena “${estado.obs.cena}” não tem: ${(estado.obs.faltando || []).join(", ")}. Clique em “Instalar no OBS”.`);
  else aviso(null);

  if (!estado) return;
  const lt = estado.lt, qr = estado.qr;

  $("noAr").hidden = !lt.noAr;
  $("atual").classList.toggle("ligado", lt.noAr);
  $("atualNome").textContent = lt.noAr ? lt.nome : "Nada no ar";
  $("atualLinha").textContent = lt.noAr ? lt.linha : "";
  $("btnTirar").disabled = !lt.noAr;

  $("qrNoAr").hidden = !qr.noAr;
  $("qrAtual").classList.toggle("ligado", qr.noAr);
  $("qrAtualTitulo").textContent = qr.noAr ? (qr.titulo || "(sem título)") : "Nada no ar";
  $("qrAtualUrl").textContent = qr.noAr ? qr.url : "";
  $("qrTirar").disabled = !qr.noAr;

  const r = estado.eng.rodizio;
  $("engNoAr").hidden = !estado.eng.tocando;
  $("rodAtivo").checked = r.ativo;
  if (document.activeElement !== $("rodMinutos")) $("rodMinutos").value = String(r.minutos);
  desenharChamadas();
  atualizarProxima();

  desenharLista("lista", "listaVazia", pessoas, lt.noAr && lt.nome, {
    chave: (p) => p.nome, titulo: (p) => p.nome, sub: (p) => p.linha || "—",
    carregar: (p) => { $("nome").value = p.nome; $("linha").value = p.linha; },
    mostrar: (p) => mostrar(p.nome, p.linha),
    remover: (i) => api("/api/predefinicoes", { lowerThirds: pessoas.filter((_, j) => j !== i) }, "PUT"),
  });
  desenharLista("links", "linksVazia", links, qr.noAr && qr.url, {
    chave: (l) => l.url, titulo: (l) => l.titulo || "(sem título)", sub: (l) => l.url,
    carregar: preencherQr,
    mostrar: (l) => mostrarQr(l),
    remover: (i) => api("/api/predefinicoes", { qrs: links.filter((_, j) => j !== i) }, "PUT"),
  });
}

// a lista só é redesenhada se mudou (não atrapalha cliques)
function desenharLista(idLista, idVazia, itens, ativo, f) {
  const chave = JSON.stringify([itens, ativo]);
  if (chaves[idLista] === chave) return;
  chaves[idLista] = chave;
  const ul = $(idLista);
  ul.replaceChildren();
  $(idVazia).hidden = itens.length > 0;
  itens.forEach((it, i) => {
    const li = document.createElement("li");
    li.className = "item" + (ativo && ativo === f.chave(it) ? " ativo" : "");
    const txt = document.createElement("div");
    txt.className = "item-texto";
    txt.title = "Carregar no formulário";
    txt.innerHTML = "<strong></strong><span></span>";
    txt.firstChild.textContent = f.titulo(it);
    txt.lastChild.textContent = f.sub(it);
    txt.onclick = () => f.carregar(it);
    const ir = document.createElement("button");
    ir.className = "ir"; ir.textContent = "Mostrar";
    ir.onclick = () => { f.carregar(it); f.mostrar(it); };
    const rem = document.createElement("button");
    rem.className = "rem"; rem.textContent = "×"; rem.title = `Remover ${f.titulo(it)}`; rem.setAttribute("aria-label", rem.title);
    rem.onclick = () => { if (confirm(`Remover “${f.titulo(it)}” da lista?`)) f.remover(i); };
    li.append(txt, ir, rem);
    ul.append(li);
  });
}

function setPilula(id, ok) {
  $(id).classList.toggle("ok", !!ok);
  $(id).classList.toggle("erro", !ok);
}
function aviso(texto) {
  $("aviso").hidden = !texto;
  $("aviso").textContent = texto || "";
}
let timerToast;
function toast(texto) {
  document.querySelector(".toast")?.remove();
  const t = Object.assign(document.createElement("div"), { className: "toast", textContent: texto });
  t.setAttribute("role", "status");
  document.body.append(t);
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.remove(), 2200);
}

// cronômetros do "no ar"
const mmss = (seg) => {
  const s = Math.max(0, Math.floor(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const relogio = (desde) => mmss((Date.now() - desde) / 1000);
function atualizarProxima() {
  const r = estado?.eng.rodizio;
  if (!r) return;
  const c = chamadas.find((x) => x.id === r.proximaId);
  $("rodProxima").textContent = !r.ativo ? "Desligado."
    : !r.ids.length ? "Marque ao menos uma chamada."
    : `Próxima: ${c?.titulo || "—"} em ${mmss((r.proxima - Date.now()) / 1000)}`;
}
setInterval(() => {
  atualizarProxima();
  if (estado?.lt.noAr && estado.lt.desde) $("tempo").textContent = relogio(estado.lt.desde);
  if (estado?.qr.noAr && estado.qr.desde) $("qrTempo").textContent = relogio(estado.qr.desde);
}, 500);

// prévia em escala
const previa = $("previa");
new ResizeObserver(() => {
  for (const f of previa.querySelectorAll("iframe")) f.style.transform = `scale(${previa.clientWidth / 1920})`;
}).observe(previa);
