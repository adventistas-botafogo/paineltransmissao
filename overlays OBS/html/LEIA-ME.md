# Overlays HTML — como usar no OBS

## Jeito recomendado: Painel do operador
O operador controla os elementos por uma página própria, sem mexer no OBS.

1. Abra o OBS (com **Ferramentas → Configurações do servidor WebSocket** ligado).
2. Dê dois cliques em `overlays OBS\painel\iniciar-painel.bat`. Uma janela preta abre e **precisa ficar aberta** durante o culto; o painel abre sozinho no navegador.
3. Na primeira vez em cada cena, clique em **Instalar no OBS**. Isso cria as fontes "Overlays Igreja - Nome", "Overlays Igreja - QR" e "Overlays Igreja - Engajamento" na cena atual.
4. **Nome:** escolha uma pessoa da lista (ou digite o nome) e clique em **Mostrar**. Para tirar: **Tirar**, a tecla **Esc** ou **Esconder tudo**.
5. **QR code:** escolha um link salvo (ou cole o link, o título e o rodapé) e clique em **Mostrar**. O QR é gerado na hora; o padrão é ficar 30 segundos na tela.
6. **Chamadas de engajamento** (Inscreva-se, Pedido de oração, Compartilhe): clique no botão da chamada; ela aparece no canto superior direito por 6 s e sai sozinha. O **Rodízio automático** toca as chamadas marcadas, uma de cada vez, no intervalo escolhido. **Esconder tudo** também desliga o rodízio.

Os vídeos das chamadas ficam em `overlays OBS\engajamento\*.webm` e são renderizados do EffectCraft (comps "Engajamento - …"). Para mudar um texto, edite a comp, renderize por cima do mesmo arquivo e pronto.

Para usar num tablet ou celular, abra o endereço "Na rede interna" que aparece na janela preta. O aparelho precisa estar na mesma rede do PC da transmissão. Se o Windows perguntar sobre o Firewall, permita **apenas em redes privadas**.

As listas de pessoas e de links ficam salvas em `painel\dados\predefinicoes.json`.

### Levar para o PC da igreja
Rode `overlays OBS\pacote\gerar-pacote.ps1`. Ele gera `pacote igreja\Overlays Igreja vX.Y.zip`, com a versão tirada de `versao.json` (veja `HISTORICO.md`). O pacote já traz o Node junto, então não precisa instalar nada além do OBS. Lá, siga o `COMO INSTALAR.txt` que vem dentro do zip. Para atualizar, gere o zip de novo e extraia por cima. As listas do PC da igreja não são sobrescritas, porque o pacote traz apenas `predefinicoes-inicial.json`.

---

## Jeito avulso (sem painel)

## Lower third (nome de quem fala)

1. No OBS: **Fontes → + → Navegador**.
2. Marque **Arquivo local** e escolha `lower-third.html` nesta pasta.
3. Largura **1920**, altura **1080**.
4. Marque **"Desligar fonte quando não estiver visível"** e **"Atualizar navegador quando a cena se tornar ativa"**. Assim a animação de entrada roda toda vez que você liga o "olho" da fonte.
5. Para trocar o texto, desmarque *Arquivo local* e use a URL completa com parâmetros:

```
file:///C:/Users/thsol/OneDrive/Documentos/Design/Claude/Adventistas Botafogo/overlays OBS/html/lower-third.html?nome=Pr. Patrick Duarte&linha=@adventistasbotafogo
```

| Parâmetro | O que faz | Padrão |
|---|---|---|
| `nome` | Texto da placa azul | Pr. Patrick Duarte |
| `linha` | Texto da placa branca | @adventistasbotafogo |
| `duracao` | Segundos até sair sozinho (com animação). Sem ele, fica até você esconder | — |

Dica: crie **uma fonte por pessoa** (duplique e troque o `nome`). No culto, basta ligar e desligar o olho.

## QR code avulso
Mesmo processo, com `qrcode.html`. Parâmetros: `url` (link do QR), `titulo` (placa azul, padrão "Siga no Instagram"), `rodape` (placa branca, padrão "Aponte a câmera"; vazio esconde a placa) e `duracao`.

## Controlar pelo terminal (opcional)
Requisito: o servidor WebSocket ligado em **Ferramentas → Configurações do servidor WebSocket** (porta 4455). O script lê a senha do próprio config do OBS.

```
cd "overlays OBS\obs-cli"
node obs.mjs cenas                              # lista as cenas
node obs.mjs fontes                             # fontes da cena atual
node obs.mjs lt "Pra. Ana Souza" "Ministério da Mulher"   # cria a fonte (escondida)
node obs.mjs mostrar "LT - Pra. Ana Souza"
node obs.mjs esconder "LT - Pra. Ana Souza"
```

## Testar antes do culto
Abra `preview.html` no navegador: ele mostra o elemento sobre o fundo de teste, tem campos para mudar o texto e gera a URL pronta para colar no OBS.
