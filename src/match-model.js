export const INITIAL_MATCH_SECOND = 28 * 60 + 15;
export const FULL_TIME_SECOND = 90 * 60;

const plan = [
  {second: 5*60+30, side:'away', type:'shot'},
  {second: 12*60, side:'home', type:'foul'},
  {second: 19*60+10, side:'away', type:'shot'},
  {second: 24*60, side:'home', type:'goal'},
  {second: 27*60+20, side:'away', type:'yellow'},
  {second: 33*60+5, side:'home', type:'corner'},
  {second: 41*60+40, side:'away', type:'goal'},
  {second: 52*60+15, side:'home', type:'yellow'},
  {second: 64*60+30, side:'home', type:'goal'},
  {second: 75*60+5, side:'away', type:'goal'},
  {second: 83*60+45, side:'home', type:'goal'},
];

const preferredPlayers = club => {
  const preferred = (club?.players || []).filter(p=>['Forward','Attacker','Midfielder'].includes(p.position));
  const fallback = (club?.players || []).filter(p=>p?.name);
  return preferred.length ? preferred : fallback;
};

const playerName = (club,index) => {
  const players=preferredPlayers(club);
  return players[index % Math.max(players.length,1)]?.name || `Jogador do ${club?.abbreviation || 'clube'}`;
};

export function createMatchEvents(home,away) {
  const homeNames=[0,1,2,3,4].map(i=>playerName(home,i));
  const awayNames=[0,1,2,3,4].map(i=>playerName(away,i));
  let hi=0, ai=0;
  return plan.map((event,index)=>{
    const club=event.side==='home'?home:away;
    const name=event.side==='home'?homeNames[hi++ % homeNames.length]:awayNames[ai++ % awayNames.length];
    const minute=Math.floor(event.second/60);
    const text=event.type==='goal' ? `GOL! ${name} marcou para o ${club.name}` :
      event.type==='yellow' ? `${name} recebe cartão amarelo` :
      event.type==='corner' ? `Escanteio para o ${club.name}` :
      event.type==='foul' ? `${name} comete falta no meio-campo` :
      `${name} finaliza; a defesa afasta`;
    return {...event,id:`event-${index}`,minute,player:name,clubId:club.id,text};
  });
}

export function scoreAt(events,second) {
  return events.filter(e=>e.type==='goal' && e.second<=second).reduce((score,event)=>{
    score[event.side]+=1;
    return score;
  },{home:0,away:0});
}

export function latestEventFor(events,side,second) {
  return [...events].reverse().find(e=>e.side===side && e.second<=second) || null;
}

export function nextEventAfter(events,second) {
  return events.find(e=>e.second>second) || null;
}

export function clockAt(second) {
  const clamped=Math.max(0,Math.min(FULL_TIME_SECOND,second));
  const minute=Math.floor(clamped/60);
  const seconds=clamped%60;
  return `${String(minute).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

export function periodAt(second) {
  if(second>=FULL_TIME_SECOND) return 'FIM DE JOGO';
  return second<45*60 ? '1º TEMPO' : '2º TEMPO';
}

export function statsAt(events,second) {
  const minute=Math.max(1,Math.floor(Math.min(second,FULL_TIME_SECOND)/60));
  const visible=events.filter(e=>e.second<=second);
  const count=(side,type)=>visible.filter(e=>e.side===side && (!type || e.type===type)).length;
  const homeGoals=count('home','goal'), awayGoals=count('away','goal');
  const homeShots=2+Math.floor(minute/11)+count('home','shot')+homeGoals;
  const awayShots=1+Math.floor(minute/13)+count('away','shot')+awayGoals;
  const homeOn=Math.max(homeGoals,Math.floor(homeShots*.48));
  const awayOn=Math.max(awayGoals,Math.floor(awayShots*.42));
  const homeCorners=count('home','corner')+Math.floor(minute/22);
  const awayCorners=Math.floor(minute/27)+1;
  const homeFouls=count('home','foul')+count('home','yellow')+Math.floor(minute/9);
  const awayFouls=count('away','foul')+count('away','yellow')+Math.floor(minute/10);
  const swing=Math.max(-4,Math.min(4,homeShots-awayShots));
  const homePossession=54+swing;
  return {
    possession:[homePossession,100-homePossession],
    shots:[homeShots,awayShots],
    onTarget:[homeOn,awayOn],
    corners:[homeCorners,awayCorners],
    fouls:[homeFouls,awayFouls],
  };
}
