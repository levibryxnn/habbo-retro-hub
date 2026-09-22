export const leagueRules = [
  { id:'champion', label:'1º · Campeão brasileiro', range:'1º', tone:'champion' },
  { id:'g4', label:'G4 · Libertadores (grupos)', range:'1º–4º', tone:'libertadores' },
  { id:'prelib', label:'Pré-Libertadores', range:'5º', tone:'prelib' },
  { id:'sudamericana', label:'Sul-Americana · faixa-base', range:'6º–11º', tone:'sudamericana' },
  { id:'relegation', label:'Rebaixamento · Série B', range:'17º–20º', tone:'relegation' },
];

// Snapshot puramente visual para a fase de laboratório.
// A engine de partidas substituirá estes números sem alterar a UI da classificação.
const demoStats = [
  [9,2,1,27,10],[8,3,1,24,11],[7,4,1,22,12],[7,3,2,21,13],[6,4,2,20,14],
  [6,3,3,19,14],[5,4,3,18,15],[5,3,4,17,15],[4,5,3,16,15],[4,4,4,17,17],
  [4,3,5,15,16],[3,5,4,14,15],[3,4,5,15,18],[3,3,6,13,17],[3,2,7,12,18],
  [2,4,6,11,18],[2,3,7,12,20],[2,2,8,10,21],[1,4,7,9,20],[1,2,9,8,24],
];

export function zoneForPosition(position) {
  if (position === 1) return {id:'champion', short:'CAM', label:'Campeão', detail:'Libertadores · grupos'};
  if (position <= 4) return {id:'libertadores', short:'LIB', label:'Libertadores', detail:'Fase de grupos'};
  if (position === 5) return {id:'prelib', short:'PRÉ', label:'Pré-Libertadores', detail:'Fase preliminar'};
  if (position <= 11) return {id:'sudamericana', short:'SUL', label:'Sul-Americana', detail:'Faixa-base'};
  if (position >= 17) return {id:'relegation', short:'Z4', label:'Rebaixamento', detail:'Série B'};
  return {id:'neutral', short:'—', label:'Permanência', detail:'Série A'};
}

export function compareStandings(a,b) {
  return b.points-a.points ||
    b.wins-a.wins ||
    b.goalDifference-a.goalDifference ||
    b.goalsFor-a.goalsFor ||
    a.club.name.localeCompare(b.club.name,'pt-BR');
}

export function buildDemoStandings(clubs) {
  return clubs.map((club,index)=>{
    const [wins,draws,losses,goalsFor,goalsAgainst]=demoStats[index % demoStats.length];
    const played=wins+draws+losses;
    const points=wins*3+draws;
    const goalDifference=goalsFor-goalsAgainst;
    return {club,played,wins,draws,losses,goalsFor,goalsAgainst,goalDifference,points};
  }).sort(compareStandings).map((row,index)=>({
    ...row,
    position:index+1,
    zone:zoneForPosition(index+1),
    efficiency:row.played ? Math.round((row.points/(row.played*3))*100) : 0,
  }));
}
