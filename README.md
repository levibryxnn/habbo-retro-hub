# Linha de Frente — Etapa 2 · v0.5

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

O projeto usa Vite e React e mantém o campo da tela de partida em SVG/CSS estático para reduzir custo de renderização. O Vite é envolvido por `@lovable.dev/lovite` para manter compatibilidade com o sandbox de preview do Lovable.

## Dados

`src/data/serie-a-2026.json` contém uma fotografia dos cadastros de elenco da temporada 2026 consultados na ESPN. Os elencos podem incluir atletas transferidos e não equivalem à lista oficial de inscrições da CBF.

Os 20 escudos usados pela interface estão em `public/crests/`, evitando requisições externas durante o jogo. O protótipo não é afiliado aos clubes, à CBF ou à ESPN.

Para atualizar a fotografia de elencos:

```sh
npm run data:update
```

O importador valida os 20 clubes esperados antes de substituir a base local.

## Sistemas funcionais

- **Partida:** a engine procedural resolve os dez jogos de cada rodada. A partida do clube do usuário pode ser reproduzida com relógio, eventos, estatísticas e velocidades 1x/2x/4x.
- **Temporada:** 20 clubes, 38 rodadas, turno e returno.
- **Classificação:** pontos, jogos, vitórias, empates, derrotas, gols, saldo e aproveitamento vêm do save.
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
