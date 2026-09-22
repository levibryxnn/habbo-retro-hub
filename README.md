# Linha de Frente — protótipo 0.1

Primeira etapa de um simulador de gerenciamento de clubes: seleção dos 20 clubes da Série A de 2026 e consulta dos elencos. Interface em português, responsiva, com busca por clube/jogador, filtros por posição, ordenação, ficha de atleta e seleção de clube persistida no navegador.

![Tela do protótipo](docs/preview-desktop.png)

## Executar

```sh
npm install
npm run dev
```

Para produção: `npm run build`. O resultado está em `dist/` e pode ser servido por qualquer hospedagem estática. `npm run preview` permite conferir o build local.

## Dados

`src/data/serie-a-2026.json` contém uma fotografia dos cadastros de elenco da temporada 2026 fornecidos pela ESPN, com data e URLs de origem. Os elencos sazonais podem incluir atletas que já saíram do clube e não equivalem a inscrições oficiais da CBF nem a uma garantia de todos os contratos vigentes. Idades são calculadas na data da consulta, quando há nascimento disponível. Dados ausentes são exibidos como não informados. Não há atributos de habilidade, salários ou valores inventados.

Os escudos vêm da ESPN e estão incluídos nos arquivos locais para evitar requisições externas durante a utilização. Marcas pertencem aos respectivos titulares. O protótipo não é afiliado aos clubes, à CBF ou à ESPN.

Para atualizar a fotografia (Python 3, internet, sem chaves):

```sh
npm run data:update
```

O importador exige os 20 clubes esperados da temporada e só substitui a base após todas as consultas serem concluídas. A interface funciona com os dados locais, sem depender da disponibilidade da fonte. A ESPN não oferece SLA contratado por este projeto; integrar uma fonte licenciada e reconciliar transferências/inscrições é uma etapa necessária antes de prometer atualização em tempo real.

## Escopo desta etapa

Seleção de clube e inspeção de elenco. O botão “Escolher este clube” salva somente a escolha local. Partidas, calendário, contratações, investimentos, patrocínios e a simulação econômica ainda não estão implementados. A engine deve ser desenvolvida em módulos separados da interface nas próximas etapas.

## Validação desta versão

Build de produção concluído. Testes no Chromium: abertura dos 20 clubes, contagem dos 941 cadastros, busca com normalização de acentos, filtro por posição, estado vazio, ordenação por idade, ficha de jogador, fechamento de modais, persistência da escolha e layout de 360 e 390 pixels sem rolagem horizontal. Sem erros JavaScript durante esses testes.
