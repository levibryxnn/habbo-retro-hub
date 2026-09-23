# Linha de Frente — beta00

Simulador de gerenciamento de clubes com temporada funcional da Série A, partidas, classificação, artilharia, transferências, patrocínios, caixa, galeria histórica de troféus e histórico do save.

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

Os 20 escudos usados pela interface estão em `public/crests/`, evitando requisições externas durante o jogo. O projeto não é afiliado aos clubes, à CBF ou à ESPN.

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

As sete áreas da carreira são:

1. Partida
2. Elenco
3. Classificação
4. Transferências
5. Troféus
6. Patrocínios
7. História

Em telas de até 850 px, a navegação usa uma grade de 3 colunas para manter todas as áreas visíveis sem depender de uma barra horizontal escondida.

## Ainda não implementado

Calendário visual completo, categorias de base funcionais, negociação com clubes de fora do Brasil, Copa do Brasil, Libertadores, Sul-Americana e Mundial jogável.

## Qualidade

O repositório possui workflow de CI em `.github/workflows/validate.yml`, executado a cada push para a `main`. Ele roda:

- `npm ci`
- `npm test`
- `npm run build`

Os testes cobrem integridade dos dados, calendário de 38 rodadas, temporada completa, campeão/troféu automático, patrocínios, recordes e presença das sete áreas da interface.

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


### Motor de partidas

A força deixou de ser um único número genérico. A engine calcula blocos separados de goleiro, defesa, meio-campo e ataque, cruza ataque contra defesa rival, considera disputa do meio, profundidade do elenco, faixa etária, mando de campo e forma recente dos últimos cinco jogos. Os eventos continuam determinísticos por seed, permitindo testes reproduzíveis sem depender de APIs pagas.

Durante uma rodada em andamento, o componente de simulação permanece montado mesmo quando o usuário navega para outra área do clube; assim a rodada continua avançando e só é oficializada quando todos os jogos terminam.


## v0.7 · decisões do técnico

- **Escalação pré-jogo:** o usuário escolhe os 11 titulares; condição física e ratings internos de jogo alimentam o motor da partida.
- **Ratings internos:** finalização, passe, defesa, pênaltis, compostura, ritmo, resistência e defesa de goleiro são gerados deterministicamente para o simulador. São atributos do jogo, não estatísticas reais dos atletas.
- **Intervalo:** a simulação pausa aos 45 minutos nos modos Normal e Rápido e oferece alterações antes do segundo tempo.
- **Substituições:** até cinco atletas; a engine controla três janelas durante o jogo, enquanto mudanças no intervalo não consomem uma janela. Jogadores expulsos não podem ser substituídos.
- **Banco e fadiga:** jogadores descansados podem gerar impacto real quando entram; uma substituição tardia pode criar um gol futuro ou eliminar acontecimentos que envolveriam o atleta retirado.
- **Cartões e suspensões:** amarelos e vermelhos são gerados pela partida; três amarelos acumulados geram uma partida de suspensão e uma expulsão gera suspensão automática na versão atual.
- **Lesões:** a probabilidade cresce com condição física baixa; a gravidade gera indisponibilidade por partidas futuras e pode abrir uma decisão de substituição durante o jogo.
- **Gestão adversária:** clubes controlados pela máquina reagem a cansaço, cartões e lesões e utilizam o banco.
- **Pênalti interativo:** nos modos Normal e Rápido, um pênalti do clube do usuário pausa o relógio e permite escolher o cobrador entre os jogadores em campo. A chance considera atributo de pênalti, compostura e capacidade do goleiro.
- **Modo Instantânea:** todas as decisões, inclusive escalação, substituições e pênaltis, são assumidas automaticamente automaticamente pelo adversário.


## v0.8 · clubes, estádios e mercado

- **Identidade por clube:** as cores do clube são aplicadas somente ao cabeçalho do clube, preservando uma interface neutra e consistente nas áreas funcionais.
- **Estádios reais:** cada mandante usa seu estádio cadastrado; a tela de partida exibe estádio, público e receita bruta estimada.
- **Matchday:** público é projetado por capacidade, força de torcida, rivalidade e momento da temporada. A parcela do clube entra no caixa quando a rodada é encerrada.
- **Economia inicial:** cada clube recebe um orçamento de gameplay diferente, calibrado por escala financeira, receita e estrutura. Esses valores não representam saldo bancário ou orçamento oficial publicado.
- **Patrocínios:** nove marcas fictícias com símbolos, níveis, pagamentos diferentes e requisitos cumulativos. As propostas mais valiosas exigem reputação, posição e/ou vitórias maiores.
- **Transferências:** compra, venda, empréstimo, saída por empréstimo e troca de jogadores são funcionais. A diretoria adversária aceita, recusa ou envia contraproposta.
- **Rivalidades:** negociações entre rivais históricos recebem resistência adicional, especialmente por jogadores considerados estrelas.
- **Empréstimos:** taxa, percentual salarial, duração até o fim da temporada e opção de compra. O jogo impede venda/troca/subempréstimo pelo clube que apenas recebeu o atleta emprestado.
- **Elencos dinâmicos:** uma negociação concluída muda o jogador de clube no próprio save e essa mudança chega à escalação e à engine de partidas.
- **Folha de novos contratos:** salários estimados de compras e percentuais salariais de empréstimos geram pagamentos periódicos no caixa.
- **Escudos:** Rodada ao Vivo e Histórico de Partidas exibem os escudos dos dois clubes.

### Referências financeiras e de mercado

As receitas e avaliações de clubes usadas para calibrar escala econômica partem de estudos públicos recentes, principalmente Sports Value 2025 e balanços divulgados por clubes/imprensa. Valores de elenco em euro usam referências Transfermarkt 2026.

Nem todos os 941 atletas do snapshot ESPN possuem correspondência individual confiável carregada. Quando existe valor individual confirmado no dataset do jogo ele é usado diretamente; nos demais casos, o simulador distribui a referência real de valor total do elenco por idade, posição e rating interno. A interface identifica esse caso como **estimativa derivada da referência do elenco**.

Orçamento inicial, salário estimado, preço de ingresso, receita líquida de matchday e exigências de negociação são **modelagens de gameplay**, não demonstrações financeiras oficiais.


## v0.8.2 · estabilidade e desempenho

- **Simulador mais leve:** o antigo cenário SVG, composto por dezenas de elementos React/SVG, foi substituído por uma única imagem WebP otimizada da visão da área técnica.
- **Engine em segundo plano sem UI pesada:** durante uma rodada, o componente continua montado para manter o relógio e as decisões, mas deixa de renderizar toda a interface da partida quando o usuário navega para outra área.
- **Mercado paginado:** a listagem deixa de criar até 180 cards simultaneamente; carrega 36 jogadores por vez e expande sob demanda.
- **Escudos:** imagens pequenas usam lazy loading e decodificação assíncrona; escudos grandes e imediatamente visíveis continuam prioritários.
- **Tema simplificado:** a identidade de cor do clube fica restrita ao bloco do escudo/nome. Mercado, partida, classificação, navegação e controles voltaram a usar a paleta neutra do jogo.
- **Limpeza:** imports sem uso e o workflow automático de lockfile foram removidos. O lockfile continua versionado e é validado por `npm ci`.
- **Preservado:** dados, testes, scripts de atualização, documentação e imagens de documentação foram mantidos porque não entram no bundle de produção ou continuam úteis para manutenção.


## v0.8.3 · fundos responsivos da partida

- O simulador passa a usar duas artes independentes: uma 16:9 para desktop/tablet e uma 9:16 recomposta para celulares.
- A versão mobile não é mais um recorte ampliado da imagem horizontal: técnico, jogadores, gramado e arquibancada permanecem enquadrados.
- Foram removidos o zoom lateral de 145% e o deslocamento negativo que comprimiam/cortavam o cenário em telas estreitas.
- O placar é redimensionado no celular para ocupar a área superior sem esconder a ação no campo.
- As imagens são WebP otimizadas e continuam estáticas para manter a simulação leve.


## v0.8.4 · mercado sob demanda

- A página de transferências não renderiza mais centenas de jogadores ao ser aberta.
- A busca agora possui quatro filtros independentes e combináveis: **Nome**, **Posição**, **Nacionalidade** e **Clube**.
- Qualquer filtro pode ser usado sozinho. Combinações tornam a pesquisa progressivamente mais específica.
- Os resultados só são montados depois de clicar em **Buscar**.
- Para preservar desempenho em celulares e computadores modestos, os resultados aparecem em lotes de 24 cards com carregamento adicional sob demanda.
- A busca por nome ignora acentos e aceita parte do nome.
- Posições são exibidas em português e nacionalidades são apresentadas em português quando o código do país está disponível.


## beta00 · primeira versão operacional

- O usuário define o **nome do técnico** ao assumir um clube; a identidade fica salva junto da carreira.
- A **galeria de troféus** mostra o acervo histórico dos 20 clubes e soma novas conquistas obtidas no save.
- Cada troféu exibe um **contador de títulos** sobre a taça.
- Os destaques individuais usam notas de **0.0 a 10.0**, calculadas por participação real nos eventos da partida, posição, gols, assistências, finalizações, cartões, disciplina, resultado e clean sheet quando aplicável.
- O relógio visual da partida usa tempo real: **60 segundos no Normal**, **30 segundos no Rápido** e resultado imediato no modo Instantânea.
- A tela de estatísticas recebeu ícones e hierarquia visual melhorada.
- Foram retirados os seletores sem função de Visão Tática, Visão TV e Dados.
- A interface não exibe rótulos de versão experimental, avisos de engine de teste ou mensagens de protótipo.
