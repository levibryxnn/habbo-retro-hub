export const leagueRules = [
  { id:'champion', label:'1º · Campeão brasileiro', range:'1º', tone:'champion' },
  { id:'g4', label:'G4 · Libertadores (grupos)', range:'1º–4º', tone:'libertadores' },
  { id:'prelib', label:'Pré-Libertadores', range:'5º', tone:'prelib' },
  { id:'sudamericana', label:'Sul-Americana · faixa-base', range:'6º–11º', tone:'sudamericana' },
  { id:'relegation', label:'Rebaixamento · Série B', range:'17º–20º', tone:'relegation' },
];

export function zoneForPosition(position) {
  if (position === 1) return {id:'champion', short:'CAM', label:'Campeão', detail:'Libertadores · grupos'};
  if (position <= 4) return {id:'libertadores', short:'LIB', label:'Libertadores', detail:'Fase de grupos'};
  if (position === 5) return {id:'prelib', short:'PRÉ', label:'Pré-Libertadores', detail:'Fase preliminar'};
  if (position <= 11) return {id:'sudamericana', short:'SUL', label:'Sul-Americana', detail:'Faixa-base'};
  if (position >= 17) return {id:'relegation', short:'Z4', label:'Rebaixamento', detail:'Série B'};
  return {id:'neutral', short:'—', label:'Permanência', detail:'Série A'};
}
