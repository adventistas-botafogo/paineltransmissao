# Overlays HTML — como usar no OBS

## Jeito recomendado: Painel do operador
O operador controla os elementos por uma página própria, sem mexer no OBS.

1. Abra o OBS (com **Ferramentas → Configurações do servidor WebSocket** ligado).
2. Dê dois cliques em `overlays OBS\painel\iniciar-painel.bat`. Uma janela preta abre e **precisa ficar aberta** durante o culto; o painel abre sozinho no navegador.
3. Na primeira vez em cada cena, clique em **Instalar no OBS**. Isso cria as fontes "Overlays Igreja - Nome", "Overlays Igreja - QR", "Overlays Igreja - Engajamento" e "Overlays Igreja - Logo" na cena atual. Se a cena já tiver uma imagem antiga do logo, oculte essa imagem para o logo não aparecer duas vezes.
**Prévia e No ar:** à direita (no tablet, no topo) ficam duas telas. **No ar** mostra os overlays que estão na tela agora, sobre fundo transparente (xadrez). **Prévia** mostra o que você tocou ou está editando, sem ir pro ar: **Animação** repete a entrada e **Mandar pro ar** leva ao vivo. Clicar no texto de um bloco salvo mostra na prévia; o botão **Pro ar** do bloco manda direto.

4. **Nome:** na aba **Salvos**, clique em **Pro ar** no bloco da pessoa (vira **Tirar** enquanto está no ar). O lápis edita; **Novo** abre o formulário. O tempo na tela (8 s, 12 s, 20 s ou ∞) fica no formulário. Para tirar: **Tirar** no topo do cartão, a tecla **Esc** ou **Esconder tudo**.
5. **QR code:** igual ao nome, com link, título e rodapé. O QR é gerado na hora; o padrão é ficar 30 segundos na tela.
6. **Chamadas:** aba **Tocar** (o olho mostra na prévia, **Pro ar** toca por 6 s), aba **Rodízio** (liga o automático, escolhe o intervalo e as chamadas) e aba **Editar textos**. **Esconder tudo** também desliga o rodízio.
7. **Logo:** **Tirar logo / Mostrar logo** (com fade). Clicar em outra versão mostra na prévia; **Usar esta versão** troca no ar. As versões são os PNGs de `overlays OBS\logo`. O **Esconder tudo** não tira o logo, e o painel lembra se ele estava ligado.

As chamadas são desenhadas em HTML (`engajamento.html`). Para mudar um texto, abra **Editar textos das chamadas** no painel: a placa se ajusta sozinha ao tamanho do texto, e **Voltar ao padrão** restaura o original.

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
