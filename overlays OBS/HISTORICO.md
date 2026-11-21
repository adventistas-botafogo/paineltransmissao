# Histórico de versões — Overlays Adventistas Botafogo

A versão atual fica em `versao.json`. Ela aparece no topo do painel, na janela preta e no nome do zip do pacote.

**Como lançar uma versão nova:**
1. Aumente o número em `versao.json`: 1.1 para ajustes e novidades pequenas, 2.0 para mudanças grandes.
2. Anote abaixo o que mudou.
3. Gere o pacote com `pacote\gerar-pacote.ps1`.
4. Grave a versão no git com `git commit` e `git tag vX.Y`.

## 1.1 — 2026-11-21
Visual mais compacto e painel novo.
- **Nome e QR no estilo compacto:** 70% do tamanho anterior, com a linha de baixo em caixa alta espaçada e um degradê escuro na base que entra e sai junto. O nome ganhou uma animação mais fluida.
- **Chamadas de engajamento em HTML:** não usam mais vídeo. O texto de cada chamada pode ser editado no painel, e a placa se ajusta ao tamanho do texto.
- **Logo da igreja no painel:** pode ser mostrado ou tirado com fade, e dá para trocar a versão (Padrão ou Sombra). Ao atualizar, oculte a imagem antiga do logo no OBS.
- **Margens unificadas:** logo, chamadas, nome e QR ficam alinhados na mesma grade (96 px das laterais, 78 px do topo e da base).
- **Painel novo:** tema grafite, abas (Salvos / Novo-Editar), blocos com "Pro ar", tempo na tela escolhido a cada inserção e telas **Prévia** e **No ar**. A prévia mostra o que está sendo editado antes de ir ao vivo.
- **Atualização mais segura:** ao abrir, o painel recarrega os overlays no OBS sozinho.

## 1.0 — 2026-11-20
Primeira versão para o PC da transmissão.
- **Nome na tela (lower third):** em HTML, controlado pelo painel, com saída automática opcional.
- **QR code:** gerado na hora a partir de qualquer link, com título e rodapé editáveis e links salvos.
- **Chamadas de engajamento:** Inscreva-se, Pedido de oração e Compartilhe, em vídeos .webm com transparência renderizados no EffectCraft. Têm botões e rodízio automático.
- **Painel do operador:** funciona no PC, no tablet e no celular da rede interna. Tem prévia ao vivo, botão "Esconder tudo" e instala as fontes no OBS sozinho.
- **Pacote portátil:** já traz o Node, pode abrir com o Windows e mantém as listas salvas quando é atualizado.
