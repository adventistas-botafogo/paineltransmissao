// Conexão com o OBS (obs-websocket v5). Requer Node 22+ (WebSocket nativo).
// A senha é lida do config do próprio OBS e nunca é exibida.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const sha = (s) => createHash("sha256").update(s).digest("base64");

export function lerConfigObs() {
  return JSON.parse(readFileSync(join(process.env.APPDATA, "obs-studio/plugin_config/obs-websocket/config.json"), "utf8"));
}

/** Conecta e autentica. Resolve com { req(tipo, dados), fechar() }. `aoFechar` é chamado se a conexão cair. */
export function conectar({ aoFechar } = {}) {
  const cfg = lerConfigObs();
  return new Promise((ok, falha) => {
    const ws = new WebSocket(`ws://127.0.0.1:${cfg.server_port || 4455}`);
    const pendentes = new Map();
    let id = 0, pronto = false;
    const api = {
      req(requestType, requestData = {}) {
        if (ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("OBS desconectado"));
        const requestId = String(++id);
        ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
        return new Promise((r, e) => pendentes.set(requestId, { r, e }));
      },
      fechar: () => ws.close(),
    };
    ws.onerror = () => { if (!pronto) falha(new Error("Não conectou ao OBS. Ele está aberto e com o servidor WebSocket ligado?")); };
    ws.onmessage = ({ data }) => {
      const { op, d } = JSON.parse(data);
      if (op === 0) {
        const ident = { rpcVersion: 1, eventSubscriptions: 0 };
        if (d.authentication) {
          const { salt, challenge } = d.authentication;
          ident.authentication = sha(sha(cfg.server_password + salt) + challenge);
        }
        ws.send(JSON.stringify({ op: 1, d: ident }));
      } else if (op === 2) { pronto = true; ok(api); }
      else if (op === 7) {
        const p = pendentes.get(d.requestId);
        if (!p) return;
        pendentes.delete(d.requestId);
        d.requestStatus.result ? p.r(d.responseData || {}) : p.e(new Error(`${d.requestType}: ${d.requestStatus.comment || d.requestStatus.code}`));
      }
    };
    ws.onclose = (e) => {
      for (const p of pendentes.values()) p.e(new Error("OBS desconectado"));
      pendentes.clear();
      if (!pronto) falha(new Error(e.code === 4009 ? "Senha do WebSocket recusada pelo OBS." : "Conexão com o OBS fechada."));
      else aoFechar?.();
    };
  });
}
