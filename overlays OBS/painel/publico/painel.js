const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...filhos) => { const e = Object.assign(document.createElement(tag), props); e.append(...filhos); return e; };
const icone = (nome) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ic"); s.innerHTML = `<use href="#i-${nome}"/>`; return s; };
let estado = null;
let pessoas = [];
let links = [];
let chamadas = [];
let logos = [];
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
  logos = m.logos || [];
  if (m.versao) { $("versao").textContent = `v${m.versao}`; $("versao").title = `Versão ${m.versao} do painel`; }
  render();
};

// ---------- abas ----------
function abrirAba(cartao, nome) {
  cartao.querySelectorAll(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
  cartao.querySelectorAll(".painel-aba").forEach((p) => {
    const ativa = p.dataset.painel === nome;
    p.classList.toggle("ativa", ativa);
    p.inert = !ativa;   // aba escondida não recebe Tab nem clique
  });
}
for (const cartao of document.querySelectorAll("[data-abas]")) {
  for (const b of cartao.querySelectorAll(".aba")) b.addEventListener("click", () => abrirAba(cartao, b.dataset.aba));
  abrirAba(cartao, cartao.querySelector(".aba.ativa").dataset.aba);
}
const radio = (nome) => Number(document.querySelector(`input[name="${nome}"]:checked`)?.value || 0);

// ---------- prévia ----------
// Os overlays da prévia rodam aqui no navegador (modo ?previa=1) e recebem o rascunho por mensagem.
// Nada disso passa pelo servidor nem pelo OBS: só "Mandar pro ar" (ou os botões de ir pro ar) vai ao vivo.
const QUADROS_PREVIA = { lt: "pvLt", qr: "pvQr", eng: "pvEng", logo: "pvLogo" };
let previa = null;   // { tipo, chave, dados, titulo, rotulo, noAr() }
const postarPrevia = (tipo, msg) => $(QUADROS_PREVIA[tipo]).contentWindow?.postMessage({ tipo: "previa", ...msg }, "*");

function mostrarPrevia(p, animar = false) {
  for (const t in QUADROS_PREVIA) if (t !== p.tipo) postarPrevia(t, { limpar: true });
  previa = p;
  postarPrevia(p.tipo, { ...p.dados, animar });
  $("pvTitulo").textContent = p.titulo;
  $("pvNoAr").textContent = p.rotulo || "Mandar pro ar";
  $("pvAnimar").disabled = $("pvNoAr").disabled = false;
  marcarSelecionados();
}
function limparPrevia(tipo) {
  if (tipo && previa?.tipo !== tipo) return;
  for (const t in QUADROS_PREVIA) postarPrevia(t, { limpar: true });
  previa = null;
  $("pvTitulo").textContent = "—";
  $("pvNoAr").textContent = "Mandar pro ar";
  $("pvAnimar").disabled = $("pvNoAr").disabled = true;
  marcarSelecionados();
}
// destaca (em verde) o bloco salvo que está na prévia
function marcarSelecionados() {
  document.querySelectorAll(".tile[data-chave]").forEach((t) => t.classList.toggle("selecionado", !!previa && t.dataset.chave === `${previa.tipo}:${previa.chave}`));
}
$("pvAnimar").onclick = () => previa && mostrarPrevia(previa, true);
$("pvNoAr").onclick = () => previa?.noAr();
// quando um quadro termina de carregar, reenvia a prévia atual (a mensagem pode ter chegado antes)
for (const [tipo, id] of Object.entries(QUADROS_PREVIA)) {
  $(id).addEventListener("load", () => setTimeout(() => { if (previa?.tipo === tipo) postarPrevia(tipo, { ...previa.dados, animar: false }); }, 400));
}

// ---------- itens salvos com edição (nome e QR usam o mesmo esquema) ----------
// cada cartão tem: aba "Salvos" (blocos) e aba "Novo"/"Editar" (formulário)
function criarEditor(cfg) {
  const ed = { indice: null };
  ed.novo = () => {
    ed.indice = null;
    cfg.preencher(cfg.vazio());
    $(cfg.aba).textContent = "Novo";
    $(cfg.salvar).textContent = "Salvar";
    $(cfg.excluir).hidden = true;
    abrirAba($(cfg.cartao), "editar");
    $(cfg.foco).focus();
    limparPrevia(cfg.tipo);
  };
  ed.editar = (i) => {
    ed.indice = i;
    cfg.preencher(cfg.lista()[i]);
    $(cfg.aba).textContent = "Editar";
    $(cfg.salvar).textContent = "Salvar alterações";
    $(cfg.excluir).hidden = false;
    abrirAba($(cfg.cartao), "editar");
    cfg.prever();
  };
  $(cfg.salvar).onclick = async () => {
    const item = cfg.ler();
    if (!cfg.valido(item)) { $(cfg.foco).focus(); return; }
    let lista = cfg.lista().slice();
    if (ed.indice !== null && lista[ed.indice]) lista[ed.indice] = item;
    else lista.push(item);
    // sem repetidos: se já havia outro com o mesmo nome/link, fica só o que acabou de ser salvo
    lista = lista.filter((x) => x === item || cfg.chave(x) !== cfg.chave(item));
    await cfg.gravar(lista);
    toast(ed.indice !== null ? "Alterações salvas" : "Salvo");
    abrirAba($(cfg.cartao), "salvos");
    ed.indice = null; $(cfg.aba).textContent = "Novo"; $(cfg.excluir).hidden = true; $(cfg.salvar).textContent = "Salvar";
  };
  $(cfg.excluir).onclick = async () => {
    const it = cfg.lista()[ed.indice];
    if (!it || !confirm(`Excluir “${cfg.titulo(it)}” dos salvos?`)) return;
    await cfg.gravar(cfg.lista().filter((_, j) => j !== ed.indice));
    toast("Excluído");
    ed.indice = null; $(cfg.aba).textContent = "Novo"; $(cfg.excluir).hidden = true; $(cfg.salvar).textContent = "Salvar";
    abrirAba($(cfg.cartao), "salvos");
  };
  return ed;
}

// blocos: clicar no corpo = prévia; botão = pro ar (ou tirar, se for o que está no ar); lápis = editar
function desenharBlocos(id, itens, ativo, f) {
  const chave = JSON.stringify([itens, ativo]);
  if (chaves[id] === chave) return;
  chaves[id] = chave;
  $(id).replaceChildren(...itens.map((it, i) => {
    const noAr = !!ativo && ativo === f.chave(it);
    const corpo = el("button", { type: "button", className: "tile-corpo", title: "Ver na prévia" }, el("strong", { textContent: f.titulo(it) }), el("span", { textContent: f.sub(it) || "—" }));
    corpo.onclick = () => f.prever(it);
    const editar = el("button", { type: "button", className: "tile-editar", title: "Editar" }, icone("lapis"));
    editar.onclick = () => f.editar(i);
    const ir = el("button", { type: "button", className: "tile-ir", textContent: noAr ? "Tirar" : "Pro ar" });
    ir.onclick = () => (noAr ? f.tirar() : f.noAr(it));
    const t = el("div", { className: "tile" + (noAr ? " ativo" : "") }, corpo, editar, ir);
    t.dataset.chave = `${f.tipo}:${f.chave(it)}`;
    return t;
  }), (() => { const b = el("button", { type: "button", className: "tile-novo" }, icone("mais"), "Novo"); b.onclick = f.novo; return b; })());
  marcarSelecionados();
}

// ---------- nome ----------
const lerNome = () => ({ nome: $("nome").value.trim(), linha: $("linha").value.trim() });
const mandarNome = (d) => d.nome && api("/api/lt", { acao: "entrar", ...d, duracao: radio("duracao") });
const tirar = () => api("/api/lt", { acao: "sair" });
function preverNomeItem(d, animar = false) {
  if (!d.nome) return limparPrevia("lt");
  mostrarPrevia({ tipo: "lt", chave: d.nome, dados: d, titulo: `Nome · ${d.nome}`, noAr: () => mandarNome(d) }, animar);
}
const edNome = criarEditor({
  tipo: "lt", cartao: "cNome", aba: "abaNomeEditar", salvar: "btnSalvar", excluir: "btnExcluir", foco: "nome",
  vazio: () => ({ nome: "", linha: "" }),
  preencher: (p) => { $("nome").value = p.nome; $("linha").value = p.linha || ""; },
  ler: lerNome, valido: (p) => !!p.nome, lista: () => pessoas, chave: (p) => p.nome, titulo: (p) => p.nome,
  prever: () => preverNomeItem(lerNome()),
  gravar: (lista) => api("/api/predefinicoes", { lowerThirds: lista }, "PUT"),
});
$("form").addEventListener("submit", (e) => { e.preventDefault(); const d = lerNome(); if (!d.nome) return $("nome").focus(); mandarNome(d); });
$("form").addEventListener("input", () => preverNomeItem(lerNome()));
$("btnPrever").onclick = () => { const d = lerNome(); if (!d.nome) return $("nome").focus(); preverNomeItem(d, true); };
$("btnTirar").onclick = tirar;

// ---------- QR code ----------
const lerQr = () => ({ url: $("qrUrl").value.trim(), titulo: $("qrTitulo").value.trim(), rodape: $("qrRodape").value.trim() });
const mandarQr = (q) => q.url && api("/api/qr", { acao: "entrar", ...q, duracao: radio("qrDuracao") });
function preverQrItem(q, animar = false) {
  if (!q.url) return limparPrevia("qr");
  mostrarPrevia({ tipo: "qr", chave: q.url, dados: q, titulo: `QR · ${q.titulo || q.url}`, noAr: () => mandarQr(q) }, animar);
}
const edQr = criarEditor({
  tipo: "qr", cartao: "cQr", aba: "abaQrEditar", salvar: "qrSalvar", excluir: "qrExcluir", foco: "qrUrl",
  vazio: () => ({ url: "", titulo: "", rodape: "" }),
  preencher: (q) => { $("qrUrl").value = q.url; $("qrTitulo").value = q.titulo || ""; $("qrRodape").value = q.rodape || ""; },
  ler: lerQr, valido: (q) => !!q.url, lista: () => links, chave: (q) => q.url, titulo: (q) => q.titulo || q.url,
  prever: () => preverQrItem(lerQr()),
  gravar: (lista) => api("/api/predefinicoes", { qrs: lista }, "PUT"),
});
$("qrForm").addEventListener("submit", (e) => { e.preventDefault(); const q = lerQr(); if (!q.url) return $("qrUrl").focus(); mandarQr(q); });
$("qrForm").addEventListener("input", () => preverQrItem(lerQr()));
$("qrPrever").onclick = () => { const q = lerQr(); if (!q.url) return $("qrUrl").focus(); preverQrItem(q, true); };
$("qrTirar").onclick = () => api("/api/qr", { acao: "sair" });

// ---------- engajamento ----------
const rodizio = (mudanca) => api("/api/eng/rodizio", mudanca);
$("rodAtivo").onchange = (e) => rodizio({ ativo: e.target.checked });
$("rodMinutos").addEventListener("change", () => rodizio({ minutos: radio("rodMinutos") }));
const tocarChamada = (id) => api("/api/eng", { acao: "tocar", id });

// textos = os do editor (ainda não salvos) ou os salvos no servidor
function preverChamada(c, textos, animar = false) {
  const editado = textos.linha1 !== c.linha1 || textos.linha2 !== c.linha2;
  mostrarPrevia({
    tipo: "eng", chave: c.id,
    dados: { icone: c.icone, linha1: textos.linha1, linha2: textos.linha2 },
    titulo: `Chamada · ${textos.linha1}${editado ? " (não salva)" : ""}`,
    rotulo: editado ? "Salvar e mandar pro ar" : "Mandar pro ar",
    noAr: async () => {
      if (editado) await api("/api/eng/textos", { id: c.id, ...textos });
      tocarChamada(c.id);
    },
  }, animar);
}

function desenharChamadas() {
  const eng = estado.eng, r = eng.rodizio;
  const chave = JSON.stringify([chamadas, eng.tocando, r.ids]);
  if (chaves.eng === chave) return;
  chaves.eng = chave;
  $("chamadas").replaceChildren(...chamadas.map((c) => {
    const noAr = eng.tocando === c.id;
    const corpo = el("button", { type: "button", className: "tile-corpo", title: "Ver na prévia" }, el("strong", { textContent: c.titulo }), el("span", { textContent: c.linha2 || c.linha1 }));
    corpo.onclick = () => preverChamada(c, c, true);
    const pv = el("button", { type: "button", className: "tile-previa", title: "Ver na prévia" }, icone("olho"));
    pv.onclick = () => preverChamada(c, c, true);
    const ir = el("button", { type: "button", className: "tile-ir", textContent: noAr ? "Parar" : "Pro ar" });
    ir.onclick = () => (noAr ? api("/api/eng", { acao: "parar" }) : tocarChamada(c.id));
    const t = el("div", { className: "tile" + (noAr ? " ativo" : "") }, corpo, el("div", { className: "tile-acoes" }, pv, ir));
    t.dataset.chave = `eng:${c.id}`;
    return t;
  }));
  $("rodIds").replaceChildren(...chamadas.map((c) => {
    const cb = el("input", { type: "checkbox", checked: r.ids.includes(c.id) });
    cb.onchange = () => rodizio({ ids: chamadas.filter((x) => x.id === c.id ? cb.checked : r.ids.includes(x.id)).map((x) => x.id) });
    return el("label", { className: "marca" }, cb, c.titulo);
  }));
  marcarSelecionados();
}

// editor de textos: uma chamada por vez (escolhida no seletor); digitar mostra na prévia
let textosAtual = null;
function escolherTextos(id) {
  textosAtual = id;
  $("engTextos").querySelectorAll(".textos-escolha input").forEach((r) => { r.checked = r.value === id; });
  $("engTextos").querySelectorAll(".eng-texto").forEach((f) => { const a = f.dataset.id === id; f.classList.toggle("ativa", a); f.inert = !a; });
}
function desenharTextosChamadas() {
  const chave = JSON.stringify(chamadas.map((c) => [c.id, c.linha1, c.linha2]));
  if (chaves.engTextos === chave) return;
  chaves.engTextos = chave;
  if (!chamadas.some((c) => c.id === textosAtual)) textosAtual = chamadas[0]?.id;
  const escolha = el("div", { className: "segmentos segmentos-largos textos-escolha" }, ...chamadas.map((c) => {
    const r = el("input", { type: "radio", name: "textosChamada", value: c.id });
    r.onchange = () => { escolherTextos(c.id); preverChamada(c, c); };
    return el("label", {}, r, el("span", { textContent: c.titulo }));
  }));
  const forms = el("div", { className: "textos-forms" }, ...chamadas.map((c) => {
    const i1 = el("input", { value: c.linha1 || "", maxLength: 40, required: true });
    const i2 = el("input", { value: c.linha2 || "", maxLength: 50 });
    const textos = () => ({ linha1: i1.value.trim(), linha2: i2.value.trim() });
    const salvar = el("button", { type: "submit", className: "btn btn-mostrar", textContent: "Salvar", disabled: true });
    const padrao = c.padrao && (c.linha1 !== c.padrao.linha1 || c.linha2 !== c.padrao.linha2);
    const voltar = el("button", { type: "button", className: "btn-link", textContent: "Padrão", title: "Voltar ao texto original", hidden: !padrao });
    voltar.onclick = () => {
      preverChamada(c, c.padrao);
      api("/api/eng/textos", { id: c.id, linha1: "" }).then(() => toast("Texto original restaurado")).catch(() => {});
    };
    const f = el("form", { className: "eng-texto", autocomplete: "off" },
      el("label", {}, "Título", i1),
      el("label", {}, "Linha de baixo", i2),
      el("div", { className: "eng-texto-acoes" }, salvar, voltar));
    f.dataset.id = c.id;
    f.oninput = () => {
      const t = textos();
      const editado = t.linha1 !== c.linha1 || t.linha2 !== c.linha2;
      salvar.disabled = !editado || !t.linha1;
      f.classList.toggle("editado", editado);
      if (t.linha1) preverChamada(c, t);
    };
    f.addEventListener("focusin", () => { if (textos().linha1) preverChamada(c, textos()); });
    f.onsubmit = (e) => {
      e.preventDefault();
      api("/api/eng/textos", { id: c.id, ...textos() }).then(() => toast("Texto salvo")).catch(() => {});
    };
    return f;
  }));
  $("engTextos").replaceChildren(el("div", { className: "textos-layout" }, escolha, forms));
  escolherTextos(textosAtual);
}

// ---------- logo ----------
$("logoBotao").onclick = () => api("/api/logo", { noAr: !estado.logo.noAr });
$("logoVersao").addEventListener("change", (e) => {
  const arquivo = e.target.value;
  const titulo = logos.find((x) => x.arquivo === arquivo)?.titulo || arquivo;
  if (arquivo === estado.logo.arquivo) { limparPrevia("logo"); return; }
  mostrarPrevia({ tipo: "logo", chave: arquivo, dados: { arquivo }, titulo: `Logo · ${titulo}`, rotulo: "Usar esta versão", noAr: () => api("/api/logo", { arquivo, noAr: true }) });
});
function desenharLogo() {
  const l = estado.logo;
  $("logoNoAr").hidden = !l.noAr;
  $("logoBotao").textContent = l.noAr ? "Tirar logo" : "Mostrar logo";
  $("logoBotao").className = "btn " + (l.noAr ? "btn-tirar" : "btn-noar");
  const chave = JSON.stringify([logos, l.arquivo]);
  if (chaves.logo === chave) return;
  chaves.logo = chave;
  $("logoVersao").replaceChildren(...logos.map((x) => {
    const span = el("span", { textContent: x.titulo, className: x.arquivo === l.arquivo ? "no-ar-marca" : "" });
    return el("label", { title: x.arquivo === l.arquivo ? "Versão no ar" : "Ver na prévia" }, el("input", { type: "radio", name: "logoVersao", value: x.arquivo, checked: x.arquivo === l.arquivo }), span);
  }));
  $("logoVersao").hidden = logos.length < 2;
}

// ---------- geral ----------
$("btnTudo").onclick = () => api("/api/esconder-tudo");
$("btnInstalar").onclick = async () => {
  const r = await api("/api/obs/instalar");
  toast(`Overlays instalados na cena “${r.cena}”`);
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && estado?.lt.noAr) { e.preventDefault(); tirar(); }
});

// ---------- tela ----------
const chaves = {};
function render() {
  setPilula("stServidor", conectado);
  const obsOk = conectado && estado?.obs.conectado;
  setPilula("stObs", obsOk);
  setPilula("stFonte", obsOk && estado.obs.fonteNaCena);
  $("stFonte").lastChild.textContent = estado?.obs.cena ? `Cena: ${estado.obs.cena}` : "Cena";
  $("btnInstalar").hidden = !(obsOk && !estado.obs.fonteNaCena);

  if (!conectado) aviso("Sem conexão com o servidor do painel. Verifique se a janela do painel está aberta no PC da transmissão.");
  else if (estado && !estado.obs.conectado) aviso(`OBS não conectado: ${estado.obs.erro || "aguardando…"}. O painel tenta de novo sozinho.`);
  else if (estado && !estado.obs.fonteNaCena) aviso(`Faltam na cena “${estado.obs.cena}”: ${(estado.obs.faltando || []).join(", ")}. Clique em “Instalar no OBS”.`);
  else aviso(null);

  if (!estado) return;
  const lt = estado.lt, qr = estado.qr, eng = estado.eng, r = eng.rodizio;

  $("noAr").hidden = $("btnTirar").hidden = !lt.noAr;
  $("cNome").classList.toggle("no-ar-ligado", lt.noAr);
  $("atualNome").textContent = lt.noAr ? lt.nome : "";

  $("qrNoAr").hidden = $("qrTirar").hidden = !qr.noAr;
  $("cQr").classList.toggle("no-ar-ligado", qr.noAr);
  $("qrAtualTitulo").textContent = qr.noAr ? (qr.titulo || qr.url) : "";

  $("engNoAr").hidden = !eng.tocando;
  $("cEng").classList.toggle("no-ar-ligado", !!eng.tocando);
  $("rodAtivo").checked = r.ativo;
  const min = document.querySelector(`input[name="rodMinutos"][value="${r.minutos}"]`);
  if (min) min.checked = true;
  desenharChamadas();
  desenharTextosChamadas();
  atualizarProxima();
  desenharLogo();

  $("noArTitulo").textContent = estado.obs.conectado ? `Cena “${estado.obs.cena || "—"}”` : "OBS desconectado";

  desenharBlocos("lista", pessoas, lt.noAr && lt.nome, {
    tipo: "lt", chave: (p) => p.nome, titulo: (p) => p.nome, sub: (p) => p.linha,
    prever: (p) => preverNomeItem({ nome: p.nome, linha: p.linha || "" }),
    noAr: (p) => mandarNome({ nome: p.nome, linha: p.linha || "" }),
    tirar, editar: edNome.editar, novo: edNome.novo,
  });
  desenharBlocos("links", links, qr.noAr && qr.url, {
    tipo: "qr", chave: (l) => l.url, titulo: (l) => l.titulo || "(sem título)", sub: (l) => l.url,
    prever: (l) => preverQrItem(l), noAr: (l) => mandarQr(l),
    tirar: () => api("/api/qr", { acao: "sair" }), editar: edQr.editar, novo: edQr.novo,
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
  const t = el("div", { className: "toast", textContent: texto });
  t.setAttribute("role", "status");
  document.body.append(t);
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.remove(), 2000);
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
  const falta = mmss((r.proxima - Date.now()) / 1000);
  $("rodChip").hidden = !r.ativo;
  $("rodChip").textContent = `Auto · ${falta}`;
  $("rodProxima").textContent = !r.ativo ? "" : !r.ids.length ? "Marque ao menos uma chamada." : `Próxima: ${c?.titulo || "—"} em ${falta}`;
}
setInterval(() => {
  atualizarProxima();
  if (estado?.lt.noAr && estado.lt.desde) $("tempo").textContent = relogio(estado.lt.desde);
  if (estado?.qr.noAr && estado.qr.desde) $("qrTempo").textContent = relogio(estado.qr.desde);
}, 500);

// overlays em escala dentro das telas
for (const tela of document.querySelectorAll(".tela")) {
  new ResizeObserver(() => {
    for (const f of tela.querySelectorAll("iframe")) f.style.transform = `scale(${tela.clientWidth / 1920})`;
  }).observe(tela);
}
