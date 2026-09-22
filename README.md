# Linha de Frente — protótipo 0.3

Protótipo de gerenciamento de clubes: seleção dos 20 clubes da Série A de 2026, consulta dos elencos, classificação do Brasileirão, galeria de troféus e patrocínios simulados. Interface em português, responsiva, com dados da gestão separados por clube e persistidos no navegador.

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

- **Elenco:** seleção do clube e inspeção dos jogadores.\n- **Classificação:** tabela de laboratório com 20 clubes, pontos e critérios básicos de ordenação; destaca campeão, G4/Libertadores, 5º na fase preliminar, faixa-base da Sul-Americana e Z4. Os números são fictícios nesta etapa e serão substituídos pela engine de partidas.
- **Troféus:** galeria da carreira com filtros nacionais/continentais. Não contém o histórico real dos clubes. Taças estilizadas e registros simulados de 2026 podem ser adicionados e removidos explicitamente no modo laboratório. Copa do Brasil e competições continentais são apenas cartões para uma etapa futura, não competições já jogáveis.
- **Patrocínios:** seis propostas fictícias para três espaços (máster, mangas e treino), com receita mensal, duração, bônus, valor total, assinatura e encerramento mediante confirmação. Apenas um contrato por espaço. As propostas são iguais para todos os clubes nesta etapa. Os totais representam projeções contratuais; não há saldo, pagamentos, vencimentos automáticos nem multa de rescisão.
- **Persistência:** `ldf.club` salva o clube escolhido; `ldf.management.v1` salva contratos e conquistas de teste por clube. A consulta de outro clube não altera seu estado; só é possível gerenciar o clube escolhido. Falhas ao salvar são sinalizadas na interface. Registros inválidos e duplicados são descartados na leitura.

Partidas, calendário, transferências e investimentos ainda não estão implementados. A classificação já está preparada para receber os resultados da futura engine sem depender da interface. As regras iniciais dos patrocínios estão separadas da interface em `src/management-model.js`.

## Novas telas

![Galeria de troféus](docs/trofeus-desktop.png)
![Patrocínios](docs/patrocinios-desktop.png)

## Validação desta versão

Build de produção concluído. Testes no Chromium: abertura dos 20 clubes, contagem dos 941 cadastros, busca com normalização de acentos, filtro por posição, estado vazio, ordenação por idade, ficha de jogador, fechamento de modais, persistência da escolha e layout de 360 e 390 pixels sem rolagem horizontal. Sem erros JavaScript durante esses testes.


### Validação da versão 0.2

`npm test` verifica exclusividade de contratos, cálculo das projeções e saneamento da persistência. Teste de navegação no Chromium verificou assinatura/cancelamento/rescisão, restauração após recarregar, separação entre clubes, adição/remoção de taças, filtros e navegação de volta ao elenco. Telas de 360 e 390 pixels verificadas sem transbordamento horizontal. Build de produção concluído.
