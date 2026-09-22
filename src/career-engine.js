import { applySponsorPayments, expireSeasonSponsors, INITIAL_CASH } from './finance-model.js';
import { worldRecordMessage } from './records-data.js';

export const CAREER_KEY = 'ldf.career.v2';

function hashString(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(value) {
  let a = hashString(value) || 1;
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function poisson(lambda, rng) {
  const limit = Math.exp(-lambda);
  let p = 1;
  let k = 0;
  do {
    k++;
    p *= rng();
  } while (p > limit && k < 8);
  return Math.max(0, k - 1);
}

const clamp = function(min,max,n){ return Math.max(min,Math.min(max,n)); };

export function buildSchedule(clubs) {
  const ids = clubs.map(function(club){ return club.id; });
  const list = ids.length % 2 ? ids.concat(null) : ids.slice();
  const n = list.length;
  const first = [];
  let rotation = list.slice();
  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a && b) {
        const flip = (round + i) % 2 === 1;
        matches.push({ homeId:flip ? b : a, awayId:flip ? a : b });
      }
    }
    first.push(matches);
    rotation = [rotation[0], rotation[n - 1]].concat(rotation.slice(1, n - 1));
  }
  return first.concat(first.map(function(matches){
    return matches.map(function(match){ return { homeId:match.awayId, awayId:match.homeId }; });
  }));
}

function playerAgeScore(player) {
  const age = player.age ?? 27;
  return clamp(0, 8, 8 - Math.abs(27 - age) * .55);
}

export function teamRating(club) {
  const players = club?.players || [];
  if (!players.length) return 55;
  const positions = { Goalkeeper:0, Defender:0, Midfielder:0, Forward:0, Attacker:0 };
  for (const player of players) {
    if (Object.hasOwn(positions, player.position)) positions[player.position]++;
  }
  const depth = Math.min(12, players.length * .28);
  const age = players.reduce(function(sum,player){ return sum + playerAgeScore(player); },0) / players.length;
  const balance = Math.min(10,positions.Goalkeeper*2)
    + Math.min(10,positions.Defender*.9)
    + Math.min(10,positions.Midfielder*.8)
    + Math.min(8,(positions.Forward+positions.Attacker)*1.1);
  return clamp(52,86,50+depth+age+balance*.45);
}

function weightedPlayer(club,rng) {
  const players = (club?.players || []).filter(function(player){ return player.name; });
  if (!players.length) return { id:'fallback-' + (club?.id || 'club'), name:'Jogador do ' + (club?.abbreviation || 'clube') };
  const weights = players.map(function(player){
    if (player.position === 'Forward' || player.position === 'Attacker') return 5;
    if (player.position === 'Midfielder') return 2.6;
    if (player.position === 'Defender') return .75;
    return .08;
  });
  const total = weights.reduce(function(a,b){ return a+b; },0);
  let roll = rng() * total;
  for (let i=0;i<players.length;i++) {
    roll -= weights[i];
    if (roll <= 0) return players[i];
  }
  return players[0];
}

function makeEvent(side,type,minute,club,player,index) {
  let text;
  if (type === 'goal') text = 'GOL! ' + player.name + ' marca para o ' + club.name;
  else if (type === 'yellow') text = player.name + ' recebe cartão amarelo';
  else if (type === 'corner') text = 'Escanteio para o ' + club.name;
  else if (type === 'foul') text = player.name + ' comete falta';
  else text = player.name + ' finaliza; a defesa responde';
  return {
    id:side + '-' + type + '-' + minute + '-' + index,
    side,
    type,
    minute,
    second:minute*60,
    playerId:String(player.id || player.name),
    player:player.name,
    clubId:club.id,
    text,
  };
}

export function simulateMatch(home,away,seed) {
  const rng = rngFrom(seed);
  const hr = teamRating(home) + 3.2;
  const ar = teamRating(away);
  const homeGoals = clamp(0,6,poisson(clamp(.35,3.4,1.28+(hr-ar)/22),rng));
  const awayGoals = clamp(0,6,poisson(clamp(.3,3.1,1.05+(ar-hr)/23),rng));
  const events = [];
  const used = new Set();
  function eventMinute() {
    let minute = 5 + Math.floor(rng()*84);
    while (used.has(minute)) minute = 5 + Math.floor(rng()*84);
    used.add(minute);
    return minute;
  }
  let eventIndex = 0;
  for (let i=0;i<homeGoals;i++) events.push(makeEvent('home','goal',eventMinute(),home,weightedPlayer(home,rng),eventIndex++));
  for (let i=0;i<awayGoals;i++) events.push(makeEvent('away','goal',eventMinute(),away,weightedPlayer(away,rng),eventIndex++));
  const extras = 8 + Math.floor(rng()*5);
  const types = ['shot','shot','foul','yellow','corner'];
  for (let i=0;i<extras;i++) {
    const side = rng() < .52 ? 'home' : 'away';
    const club = side === 'home' ? home : away;
    const type = types[Math.floor(rng()*types.length)];
    events.push(makeEvent(side,type,eventMinute(),club,weightedPlayer(club,rng),eventIndex++));
  }
  events.sort(function(a,b){ return a.minute-b.minute; });
  const homeShots = Math.max(homeGoals,5+Math.floor(rng()*8)+homeGoals);
  const awayShots = Math.max(awayGoals,4+Math.floor(rng()*8)+awayGoals);
  const possession = clamp(40,64,Math.round(50+(hr-ar)*.7+(rng()-.5)*7));
  return {
    id:String(seed),
    homeId:home.id,
    awayId:away.id,
    homeGoals,
    awayGoals,
    events,
    stats:{
      possession:[possession,100-possession],
      shots:[homeShots,awayShots],
      onTarget:[
        Math.max(homeGoals,Math.round(homeShots*(.35+rng()*.18))),
        Math.max(awayGoals,Math.round(awayShots*(.35+rng()*.18))),
      ],
      corners:[Math.floor(rng()*7),Math.floor(rng()*7)],
      fouls:[7+Math.floor(rng()*10),7+Math.floor(rng()*10)],
    },
  };
}

export function standingsFromResults(results,clubs) {
  const rows = Object.fromEntries(clubs.map(function(club){
    return [club.id,{ clubId:club.id, played:0, wins:0, draws:0, losses:0, goalsFor:0, goalsAgainst:0, goalDifference:0, points:0 }];
  }));
  for (const result of results || []) {
    const home = rows[result.homeId];
    const away = rows[result.awayId];
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;
    if (result.homeGoals > result.awayGoals) {
      home.wins++;
      away.losses++;
      home.points += 3;
    } else if (result.homeGoals < result.awayGoals) {
      away.wins++;
      home.losses++;
      away.points += 3;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  }
  return Object.values(rows).map(function(row){
    return { ...row, goalDifference:row.goalsFor-row.goalsAgainst };
  }).sort(function(a,b){
    return b.points-a.points || b.wins-a.wins || b.goalDifference-a.goalDifference || b.goalsFor-a.goalsFor || String(a.clubId).localeCompare(String(b.clubId));
  }).map(function(row,index){
    return { ...row, position:index+1, efficiency:row.played ? Math.round(row.points/(row.played*3)*100) : 0 };
  });
}

function addScorers(map,result) {
  const next = { ...(map || {}) };
  for (const event of result.events.filter(function(item){ return item.type === 'goal'; })) {
    const key = event.clubId + ':' + event.playerId;
    next[key] = {
      playerId:event.playerId,
      name:event.player,
      clubId:event.clubId,
      goals:(next[key]?.goals || 0) + 1,
    };
  }
  return next;
}

export function topScorers(map,limit) {
  const size = limit ?? 20;
  return Object.values(map || {}).sort(function(a,b){
    return b.goals-a.goals || a.name.localeCompare(b.name,'pt-BR');
  }).slice(0,size);
}

export function createCareer(clubs,userClubId,season) {
  return {
    version:2,
    userClubId,
    season:season || 2026,
    round:0,
    schedule:buildSchedule(clubs),
    results:[],
    scorers:{},
    allTimeScorers:{},
    cash:INITIAL_CASH,
    transactions:[],
    sponsors:[],
    trophies:[],
    messages:[],
    seasons:[],
    lastUserMatch:null,
  };
}

export function sanitizeCareer(raw,clubs,userClubId) {
  if (!raw || typeof raw !== 'object' || raw.userClubId !== userClubId) return createCareer(clubs,userClubId);
  return {
    ...createCareer(clubs,userClubId,Number(raw.season)||2026),
    ...raw,
    schedule:Array.isArray(raw.schedule) && raw.schedule.length === 38 ? raw.schedule : buildSchedule(clubs),
    results:Array.isArray(raw.results) ? raw.results : [],
    scorers:raw.scorers && typeof raw.scorers === 'object' ? raw.scorers : {},
    allTimeScorers:raw.allTimeScorers && typeof raw.allTimeScorers === 'object' ? raw.allTimeScorers : {},
    sponsors:Array.isArray(raw.sponsors) ? raw.sponsors : [],
    trophies:Array.isArray(raw.trophies) ? raw.trophies : [],
    transactions:Array.isArray(raw.transactions) ? raw.transactions : [],
    messages:Array.isArray(raw.messages) ? raw.messages : [],
    seasons:Array.isArray(raw.seasons) ? raw.seasons : [],
  };
}

export function fixtureForUser(career) {
  if (career.round >= career.schedule.length) return null;
  return career.schedule[career.round].find(function(match){
    return match.homeId === career.userClubId || match.awayId === career.userClubId;
  }) || null;
}

function userOutcome(result,userClubId) {
  const home = result.homeId === userClubId;
  const gf = home ? result.homeGoals : result.awayGoals;
  const ga = home ? result.awayGoals : result.homeGoals;
  return { winner:gf>ga ? 'user' : gf<ga ? 'opponent' : 'draw', goalsFor:gf, goalsAgainst:ga };
}

function finalizeSeason(career,clubs) {
  const table = standingsFromResults(career.results,clubs);
  const champion = table[0];
  const leaders = topScorers(career.scorers,1);
  let next = {
    ...career,
    seasons:[...(career.seasons || []),{ season:career.season, championId:champion?.clubId, topScorer:leaders[0] || null }],
  };
  if (champion?.clubId === career.userClubId) {
    const club = clubs.find(function(item){ return item.id === career.userClubId; });
    next = {
      ...next,
      trophies:[...(next.trophies || []),{ id:'brasileirao', season:career.season, earnedAtRound:38 }],
      messages:[
        {
          id:'brasileirao-' + career.season,
          type:'title',
          title:'Campeão brasileiro!',
          text:(club?.name || 'Seu clube') + ' conquistou o Brasileirão ' + career.season + '. A taça foi adicionada automaticamente à galeria.',
        },
        ...(next.messages || []),
      ],
    };
  }
  return expireSeasonSponsors(next);
}

export function simulateRound(career,clubs) {
  if (career.round >= career.schedule.length) return career;
  const roundNumber = career.round + 1;
  const fixtures = career.schedule[career.round];
  let scorers = { ...career.scorers };
  let allTime = { ...career.allTimeScorers };
  const roundResults = fixtures.map(function(fixture,index){
    const home = clubs.find(function(club){ return club.id === fixture.homeId; });
    const away = clubs.find(function(club){ return club.id === fixture.awayId; });
    const seed = career.season + '-' + roundNumber + '-' + index + '-' + home.id + '-' + away.id;
    const result = simulateMatch(home,away,seed);
    scorers = addScorers(scorers,result);
    allTime = addScorers(allTime,result);
    return result;
  });
  const userResult = roundResults.find(function(result){
    return result.homeId === career.userClubId || result.awayId === career.userClubId;
  });
  let next = {
    ...career,
    round:roundNumber,
    results:[...career.results,...roundResults],
    scorers,
    allTimeScorers:allTime,
    lastUserMatch:userResult,
  };
  next = applySponsorPayments(next,roundNumber,userOutcome(userResult,career.userClubId));
  if (roundNumber === career.schedule.length) next = finalizeSeason(next,clubs);
  return next;
}

export function startNextSeason(career,clubs) {
  if (career.round < career.schedule.length) return career;
  return {
    ...career,
    season:career.season+1,
    round:0,
    schedule:buildSchedule(clubs),
    results:[],
    scorers:{},
    lastUserMatch:null,
    sponsors:(career.sponsors || []).map(function(contract){ return { ...contract, active:false }; }),
  };
}

export function addWorldTitle(career,clubName) {
  const count = (career.trophies || []).filter(function(trophy){ return trophy.id === 'world'; }).length + 1;
  let next = {
    ...career,
    trophies:[...(career.trophies || []),{ id:'world', season:career.season, earnedAtRound:career.round }],
  };
  const message = worldRecordMessage(clubName,count);
  if (message && !(next.messages || []).some(function(item){ return item.id === message.id; })) {
    next = { ...next, messages:[message,...(next.messages || [])] };
  }
  return next;
}
