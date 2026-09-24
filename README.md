# Linha de Frente — 1.0 RC2

**Linha de Frente** é um simulador de técnico e gerenciamento de futebol brasileiro feito em React + Vite, com foco em carreira longa, calendário integrado, decisões de gestão e baixo custo de processamento.

A build é portátil, roda sem backend obrigatório e não depende do runtime do Lovable.

## Executar

```sh
npm ci
npm run dev
```

Validação:

```sh
npm test
npm run build
```

## Visão geral

A carreira começa em uma tela própria de abertura, passa pelo seletor de clubes da Série A e evolui em um único save com:

- estadual do clube;
- Brasileirão Série A;
- Copa do Brasil;
- Libertadores;
- Sul-Americana;
- competições regionais quando aplicável;
- Supercopa;
- Champions League simulada em segundo plano;
- Mundial alimentado pelos campeões continentais.

O calendário é único: o jogo impede que uma competição seja pulada para avançar outra.

## Gestão esportiva

- três velocidades de partida: **Normal, Rápido e Instantânea**;
- escalação, banco, substituições, intervalo e pênaltis;
- CPU com planos táticos e decisões de substituição;
- condição física, cartões, suspensões e lesões;
- lesões afetam temporariamente o overall conforme gravidade;
- ratings e atributos internos determinísticos;
- progressão de jogador ao longo das temporadas;
- crescimento possível até a faixa dos 35 anos e declínio posterior;
- aposentadoria aos 45 anos;
- regeneração de jogadores e sucessores de carreira;
- categorias de base com potencial variável e parcialmente oculto.

## Carreira e bastidores

A aba **Bastidores** reúne os sistemas que tornam o save diferente a cada temporada:

- personalidade do treinador;
- reputação;
- confiança da torcida;
- confiança da diretoria;
- perfil de presidente/diretoria;
- DNA do clube;
- moral e união do vestiário;
- jogadores insatisfeitos e pedidos de saída;
- coletivas curtas com consequências;
- rivalidades emergentes;
- memória histórica da carreira;
- marcos de jogos, vitórias, títulos, vendas e base;
- Hall da Fama;
- notícias geradas localmente a partir dos acontecimentos reais do save;
- notícias do universo sobre títulos, decisões e surpresas de outras competições.

O motor editorial é procedural e determinístico: não depende de API paga para o jogo funcionar.

## Mercado e economia

Caixa e orçamento de transferências são sistemas diferentes.

A economia considera:

- orçamento de mercado limitado por perfil do clube;
- teto reservado para novos salários;
- reinvestimento parcial do valor das vendas;
- saúde financeira;
- confiança da diretoria;
- estilo da presidência;
- posição final da temporada;
- patrocínios;
- receitas de matchday;
- eventos financeiros;
- valor de mercado e desempenho;
- reputação do projeto;
- interesse do jogador e do estafe;
- resistência de rivais;
- força financeira do clube comprador.

Ter dinheiro em caixa não é suficiente para contratar qualquer jogador.

## Scouting e base

Jogadores não observados podem aparecer com faixa estimada de overall. A precisão aumenta conforme a observação.

A base gera prospectos deterministicamente a cada temporada, com:

- overall inicial;
- potencial oculto;
- distribuição desigual de talento;
- influência do perfil do treinador;
- influência do DNA do clube;
- promoção para o profissional.

## Save

A carreira possui três camadas de persistência:

1. **autosave no navegador**;
2. **slots manuais locais** para checkpoints;
3. **arquivo portátil `.ldf`** para backup e transferência entre navegadores/aparelhos.

O arquivo `.ldf` contém apenas o estado da carreira, não o HTML inteiro do jogo.

## Interface

A direção visual evita aparência de dashboard genérico:

- abertura em gramado;
- navegação editorial;
- placares e tabelas;
- identidade de clube;
- tela de partida otimizada para desktop e celular;
- taças vetoriais leves;
- histórico multicompetição;
- carregamento progressivo de listas;
- escudos com lazy loading e fallback seguro.

## Performance

O projeto prioriza aparelhos modestos:

- imagens de estádio em WebP;
- listas de mercado sob demanda;
- histórico paginado;
- resultados históricos compactados;
- cache de atributos determinísticos;
- cache de rateio de mercado;
- persistência adiada para períodos ociosos;
- componentes pesados fora da tela evitam pintura desnecessária;
- save de longa duração possui testes de tamanho.

## Dados

`src/data/serie-a-2026.json` contém uma fotografia dos elencos da Série A consultada na ESPN.

Escudos dos 20 clubes da Série A ficam em `public/crests/`. Clubes externos usam fonte curada quando disponível e fallback de escudo quando a imagem não pode ser validada.

Os valores financeiros são **modelagem de gameplay**, não demonstrações financeiras oficiais.

## Qualidade e CI

O workflow `.github/workflows/validate.yml` roda a cada push para `main`:

- `npm ci`;
- suíte completa de testes;
- auditoria de módulos órfãos;
- auditoria de rótulos de protótipo;
- build Vite;
- falha automática em erro de sintaxe CSS;
- geração do artefato de preview.

Os testes cobrem, entre outros:

- 38 rodadas e temporada completa;
- calendário multicompetição;
- confiança e demissão;
- mercado e orçamento;
- save portátil;
- slots manuais;
- scouting;
- base;
- aposentadoria e regens;
- lesões;
- rivalidades;
- notícias;
- marcos;
- integração dos sistemas de release.

## Estrutura principal

- `src/career-engine.js` — temporada e save;
- `src/competition-engine.js` — calendário e competições;
- `src/career-dynamics.js` — vestiário, reputação, memória, notícias e carreira;
- `src/economy-engine.js` — orçamento e folha;
- `src/transfer-engine.js` — mercado e negociações;
- `src/development-engine.js` — envelhecimento, potencial, aposentadoria e regens;
- `src/save-format.js` — `.ldf` e slots locais;
- `src/MatchSimulation.jsx` — tela e fluxo da partida;
- `src/CareerCenter.jsx` — Bastidores;
- `src/LandingScreen.jsx` — abertura do jogo.

## Estado atual

**1.0 RC2** é a candidata de lançamento integrada. O objetivo desta etapa é validar comportamento de longo prazo, compatibilidade entre navegadores e polimento final sem reescrever a base.
