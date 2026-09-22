export const realWorldRecords = {
  worldClub: {
    holder: 'Real Madrid',
    value: 9,
    label: 'títulos mundiais de clubes',
    source: 'FIFA',
    sourceUrl: 'https://www.fifa.com/en/tournaments/mens/intercontinentalcup/2024/articles/real-madrid-finals-tournaments',
    checkedAt: '2026-09-22',
  },
  brasileiraoClub: {
    holder: 'Palmeiras',
    value: 12,
    label: 'títulos do Campeonato Brasileiro',
    source: 'CBF',
    sourceUrl: 'https://www.cbf.com.br/futebol-brasileiro/noticias/detalhes/competicoes-campeonato-brasileiro-serie-a/palmeiras-celebra-110-anos-de-muita-tradicao-e-glorias',
    checkedAt: '2026-09-22',
  },
  brasileiraoScorer: {
    holder: 'Roberto Dinamite',
    value: 190,
    label: 'gols no Campeonato Brasileiro',
    source: 'CBF',
    sourceUrl: 'https://www.cbf.com.br/futebol-brasileiro/noticias/campeonato-brasileiro-serie-a/a/gabigol-sobe-para-a-8-posicao-na-artilharia-historia-do-brasileirao',
    checkedAt: '2026-09-22',
  },
};

export const historicalClubHonours = {
  'São Paulo': { world: 3 },
};

export const brasileiraoHistoricalScorers = [
  { name:'Roberto Dinamite', goals:190 },
  { name:'Fred', goals:158 },
  { name:'Romário', goals:154 },
  { name:'Edmundo', goals:153 },
  { name:'Zico', goals:135 },
  { name:'Diego Souza', goals:130 },
  { name:'Túlio Maravilha', goals:129 },
  { name:'Serginho Chulapa', goals:127 },
  { name:'Dario', goals:127 },
  { name:'Gabigol', goals:127 },
];

export function historicalWorldTitles(clubName) {
  return historicalClubHonours[clubName]?.world ?? null;
}

export function worldRecordMessage(clubName, managedWorldTitles) {
  const baseline = historicalWorldTitles(clubName);
  if (baseline === null) return null;
  const total = baseline + managedWorldTitles;
  if (total <= realWorldRecords.worldClub.value) return null;
  return {
    id: 'world-record-' + clubName + '-' + total,
    type: 'record',
    title: 'O topo do mundo agora é seu.',
    text: 'Meus parabéns! Com ' + total + ' títulos mundiais somando a história real carregada e a sua gestão, o ' + clubName + ' superou a referência de ' + realWorldRecords.worldClub.value + ' conquistas mundiais do Real Madrid usada pelo jogo.',
  };
}
