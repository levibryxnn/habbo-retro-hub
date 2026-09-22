# Linha de Frente — Etapa 2 · v0.7

Simulador de gerenciamento de clubes em desenvolvimento. A Etapa 2 conecta uma temporada funcional da Série A a partidas, classificação, artilharia, patrocínios, caixa, troféus e histórico do save.

## Executar

```sh
npm ci
npm run dev
```

Validação local/CI:

```sh
npm test
npm run build
```

O projeto usa React + Vite puro e mantém o campo da tela de partida em SVG/CSS estático para reduzir custo de renderização. O build é portátil e não depende do runtime do Lovable.

## Dados

`src/data/serie-a-2026.json` contém uma fotografia dos cadastros de elenco da temporada 2026 consultados na ESPN. Os elencos podem incluir atletas transferidos e não equivalem à lista oficial de inscrições da CBF.

Os 20 escudos usados pela interface estão em `public/crests/`, evitando requisições externas durante o jogo. O protótipo não é afiliado aos clubes, à CBF ou à ESPN.

Para atualizar a fotografia de elencos:

```sh
npm run data:update
```

O importador valida os 20 clubes esperados antes de substituir a base local.

## Sistemas funcionais

- **Partida:** a rodada inteira acontece de forma coordenada. Os 10 jogos usam o mesmo relógio de rodada, têm eventos e acréscimos próprios e não permitem iniciar uma nova rodada antes do encerramento da atual. O usuário escolhe entre Normal, Rápido e Instantânea.
- **Temporada:** 20 clubes, 38 rodadas, turno e returno.
- **Classificação:** pontos, jogos, vitórias, empates, derrotas, gols, saldo e aproveitamento só entram oficialmente após o encerramento completo da rodada.
- **Histórico de partidas:** registra rodada, placar, competição, resultado e pontos conquistados pelo clube do usuário ao longo da carreira.
- **Artilharia:** registra gols da temporada e ranking acumulado da carreira.
- **Patrocínios:** propostas fictícias possuem requisitos e modelos de pagamento diferentes: à vista, parcelas periódicas, por rodada ou por performance.
- **Caixa:** pagamentos de patrocínio geram movimentações e alteram o saldo da carreira.
- **Troféus:** ao fim da 38ª rodada, o campeão controlado pelo usuário recebe automaticamente o Brasileirão na galeria.
- **História:** mostra artilharia, referências históricas, mensagens de marcos e a estrutura inicial do Hall da Fama de jogadores, clubes e técnicos.
- **Recordes:** a estrutura compara marcas do save com referências históricas cadastradas. Competições ainda não jogáveis, como o Mundial, já possuem suporte de dados para uso futuro.

## Persistência

- `ldf.club`: clube escolhido.
- `ldf.career.v2`: temporada, resultados, artilharia, caixa, contratos, transações, títulos, mensagens e histórico.

A lógica antiga de laboratório de partidas e patrocínios foi removida para evitar duas fontes de verdade.

## Navegação

As seis áreas da carreira são:

1. Partida
2. Elenco
3. Classificação
4. Troféus
5. Patrocínios
6. História

Em telas de até 850 px, a navegação usa uma grade de 3 colunas para manter todas as áreas visíveis sem depender de uma barra horizontal escondida.

## Ainda não implementado

Mercado de transferências, calendário visual, táticas/escalação com impacto na engine, lesões, Copa do Brasil, Libertadores, Sul-Americana e Mundial jogável.

## Qualidade

O repositório possui workflow de CI em `.github/workflows/validate.yml`, executado a cada push para a `main`. Ele roda:

- `npm ci`
- `npm test`
- `npm run build`

Os testes cobrem integridade dos dados, calendário de 38 rodadas, temporada completa, campeão/troféu automático, patrocínios, recordes e presença das seis áreas da interface.

## Preview público e desenvolvimento local

Preview funcional atual: **https://linha-de-frente.lovable.app**

A aplicação não depende mais do runtime ou do Vite do Lovable: o código usa React + Vite puro, com `base: './'`, portanto o mesmo build pode ser servido por qualquer hospedagem estática.

Para testar no computador:

```sh
npm ci
npm run dev
```

Abra `http://localhost:8080`.

O GitHub Actions valida automaticamente testes e build e gera o artefato `linha-de-frente-preview`. Há também um smoke test externo que acessa a URL pública, exige HTTP 200 e confirma o carregamento dos assets do jogo.

Para um domínio próprio no futuro, basta conectar este mesmo repositório a uma hospedagem estática como Vercel, Cloudflare Pages ou Netlify e apontar o DNS; não será necessário reescrever o jogo.


### IA de partidas v2

A força deixou de ser um único número genérico. A engine calcula blocos separados de goleiro, defesa, meio-campo e ataque, cruza ataque contra defesa rival, considera disputa do meio, profundidade do elenco, faixa etária, mando de campo e forma recente dos últimos cinco jogos. Os eventos continuam determinísticos por seed, permitindo testes reproduzíveis sem depender de APIs pagas.

Durante uma rodada em andamento, o componente de simulação permanece montado mesmo quando o usuário navega para outra área do clube; assim a rodada continua avançando e só é oficializada quando todos os jogos terminam.


## v0.7 · decisões do técnico

- **Escalação pré-jogo:** o usuário escolhe os 11 titulares; condição física e ratings internos de jogo alimentam a IA.
- **Ratings internos:** finalização, passe, defesa, pênaltis, compostura, ritmo, resistência e defesa de goleiro são gerados deterministicamente para o simulador. São atributos do jogo, não estatísticas reais dos atletas.
- **Intervalo:** a simulação pausa aos 45 minutos nos modos Normal e Rápido e oferece alterações antes do segundo tempo.
- **Substituições:** até cinco atletas; a engine controla três janelas durante o jogo, enquanto mudanças no intervalo não consomem uma janela. Jogadores expulsos não podem ser substituídos.
- **Banco e fadiga:** jogadores descansados podem gerar impacto real quando entram; uma substituição tardia pode criar um gol futuro ou eliminar acontecimentos que envolveriam o atleta retirado.
- **Cartões e suspensões:** amarelos e vermelhos são gerados pela partida; três amarelos acumulados geram uma partida de suspensão e uma expulsão gera suspensão automática na versão atual.
- **Lesões:** a probabilidade cresce com condição física baixa; a gravidade gera indisponibilidade por partidas futuras e pode abrir uma decisão de substituição durante o jogo.
- **IA adversária:** clubes controlados pela máquina reagem a cansaço, cartões e lesões e utilizam o banco.
- **Pênalti interativo:** nos modos Normal e Rápido, um pênalti do clube do usuário pausa o relógio e permite escolher o cobrador entre os jogadores em campo. A chance considera atributo de pênalti, compostura e capacidade do goleiro.
- **Modo Instantânea:** todas as decisões, inclusive escalação, substituições e pênaltis, são assumidas automaticamente pela IA.
