#!/usr/bin/env node
// Controle do OBS pelo terminal (obs-websocket v5). Requer Node 22+ (WebSocket nativo).
// A senha é lida do config do próprio OBS; nada é exibido.
//
// Uso:
//   node obs.mjs cenas
//   node obs.mjs fontes [cena]
//   node obs.mjs mostrar <fonte> [cena]
//   node obs.mjs esconder <fonte> [cena]
//   node obs.mjs alternar <fonte> [cena]
//   node obs.mjs lt "<nome>" ["<linha>"] [cena]   -> cria/atualiza fonte "LT - <nome>" (começa escondida)
//   node obs.mjs req <TipoDeRequisicao> ['{"json":"opcional"}']

import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { conectar } from "./obs-ws.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const HTML = resolve(AQUI, "..", "html");

async function cenaAtual(obs) {
  return (await obs.req("GetCurrentProgramScene")).currentProgramSceneName;
}
async function itemId(obs, cena, fonte) {
  return (await obs.req("GetSceneItemId", { sceneName: cena, sourceName: fonte })).sceneItemId;
}
async function visibilidade(obs, fonte, cena, modo) {
  cena ||= await cenaAtual(obs);
  const sceneItemId = await itemId(obs, cena, fonte);
  let sceneItemEnabled = modo;
  if (modo === null) sceneItemEnabled = !(await obs.req("GetSceneItemEnabled", { sceneName: cena, sceneItemId })).sceneItemEnabled;
  await obs.req("SetSceneItemEnabled", { sceneName: cena, sceneItemId, sceneItemEnabled });
  console.log(`${sceneItemEnabled ? "▶ mostrando" : "■ escondido"}: ${fonte}  (cena "${cena}")`);
}

const [cmd, ...args] = process.argv.slice(2);
const obs = await conectar().catch((e) => { console.error(e.message); process.exit(1); });

try {
  switch (cmd) {
    case "cenas": {
      const { scenes, currentProgramSceneName } = await obs.req("GetSceneList");
      for (const s of scenes.reverse()) console.log(`${s.sceneName === currentProgramSceneName ? "●" : " "} ${s.sceneName}`);
      break;
    }
    case "fontes": {
      const cena = args[0] || (await cenaAtual(obs));
      const { sceneItems } = await obs.req("GetSceneItemList", { sceneName: cena });
      console.log(`Cena "${cena}":`);
      for (const i of sceneItems.reverse()) console.log(`  ${i.sceneItemEnabled ? "👁" : "  "} ${i.sourceName}  [${i.inputKind || "grupo/cena"}]`);
      break;
    }
    case "mostrar":  await visibilidade(obs, args[0], args[1], true); break;
    case "esconder": await visibilidade(obs, args[0], args[1], false); break;
    case "alternar": await visibilidade(obs, args[0], args[1], null); break;
    case "lt": {
      const [nome, linha = "@adventistasbotafogo", cenaArg] = args;
      if (!nome) throw new Error('Informe o nome: node obs.mjs lt "Pr. Fulano"');
      const cena = cenaArg || (await cenaAtual(obs));
      const fonte = `LT - ${nome}`;
      const q = new URLSearchParams({ nome, linha }).toString().replace(/\+/g, "%20");
      const inputSettings = {
        is_local_file: false,
        url: pathToFileURL(join(HTML, "lower-third.html")).href + "?" + q,
        width: 1920, height: 1080,
        shutdown: true,          // desliga quando invisível
        restart_when_active: true,
        reroute_audio: false,
      };
      const { inputs } = await obs.req("GetInputList");
      if (inputs.some((i) => i.inputName === fonte)) {
        await obs.req("SetInputSettings", { inputName: fonte, inputSettings });
        console.log(`Atualizada: ${fonte}`);
      } else {
        await obs.req("CreateInput", { sceneName: cena, inputName: fonte, inputKind: "browser_source", inputSettings, sceneItemEnabled: false });
        console.log(`Criada (escondida) na cena "${cena}": ${fonte}`);
      }
      break;
    }
    case "req": {
      const r = await obs.req(args[0], args[1] ? JSON.parse(args[1]) : {});
      console.log(JSON.stringify(r, null, 2));
      break;
    }
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 13).join("\n").replace(/^\/\/ ?/gm, ""));
  }
} catch (e) {
  console.error("Erro:", e.message);
  process.exitCode = 1;
} finally {
  obs.fechar();
}
