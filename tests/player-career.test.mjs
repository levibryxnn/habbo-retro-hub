import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TRIAL_DRILLS,
  acknowledgePlayerMoment,
  advancePlayerLiveMatch,
  answerTrialDrill,
  completeTrial,
  createPlayerCareer,
  parsePlayerCareer,
  playerCareerOverall,
  playerObjectiveSnapshot,
  playerAgendaSnapshot,
  playerSquadCompetitionSnapshot,
  negotiatePlayerContractOffer,
  respondPlayerContractOffer,
  respondPlayerOffer,
  sanitizePlayerCareer,
  serializePlayerCareer,
  setPlayerContractPreference,
  setPlayerLiveApproach,
  setPlayerMatchApproach,
  simulatePlayerDay,
  simulatePlayerLiveMatchToEnd,
  simulatePlayerUntilNextMatch,
  simulatePlayerWeek,
  trialScore,
} from '../src/player-career-engine.js';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/serie-a-2026.json',import.meta.url),'utf8'));
const clubs=data.clubs;

function finishTrial(career){
  let next=career;
  for(const drill of TRIAL_DRILLS)next=answerTrialDrill(next,drill.id,drill.choices[0].id);
  return completeTrial(next,clubs);
}

test('player career always starts at 16 with no selected club',function(){
  const career=createPlayerCareer({name:'Teste',position:'MEI',archetype:'technical',dreamClubId:clubs[0].id},2026);
  assert.equal(career.mode,'player');
  assert.equal(career.age,16);
  assert.equal(career.stage,'trial');
  assert.equal(career.clubId,null);
  assert.equal(career.dreamClubId,clubs[0].id);
  assert.ok(playerCareerOverall(career)>=40);
});

test('trial score is seeded and club entry comes only after all five drills',function(){
  const base=createPlayerCareer({name:'Teste Peneira',position:'ATA',archetype:'fast',dreamClubId:clubs[1].id},2026);
  let answered=base;
  for(const drill of TRIAL_DRILLS)answered=answerTrialDrill(answered,drill.id,drill.choices[0].id);
  const first=trialScore(answered),second=trialScore(answered);
  assert.equal(first,second);
  assert.ok(first>=0&&first<=100);
  const signed=completeTrial(answered,clubs);
  assert.equal(signed.stage,'academy');
  assert.ok(signed.clubId);
  assert.equal(signed.trial.completed,true);
  assert.equal(signed.trial.score,first);
});

test('weekly player simulation keeps all sensitive values bounded across seasons',function(){
  let career=finishTrial(createPlayerCareer({name:'Longo Prazo',position:'DEF',archetype:'strong',dreamClubId:clubs[2].id},2026));
  for(let i=0;i<80;i++)career=simulatePlayerWeek(career,clubs);
  assert.ok(career.age>=17);
  assert.ok(career.season>=2027);
  assert.ok(career.player.condition>=35&&career.player.condition<=100);
  assert.ok(career.player.morale>=0&&career.player.morale<=100);
  assert.ok(career.player.coachTrust>=0&&career.player.coachTrust<=100);
  assert.ok(playerCareerOverall(career)>=40&&playerCareerOverall(career)<=97);
  assert.ok(career.careerStats.matches>=0);
});

test('portable player save round-trips without touching manager save format',function(){
  const original=finishTrial(createPlayerCareer({name:'Portátil',position:'GOL',archetype:'technical',dreamClubId:clubs[3].id},2026));
  const raw=serializePlayerCareer(original),restored=parsePlayerCareer(raw,clubs);
  assert.equal(restored.mode,'player');
  assert.equal(restored.player.name,'Portátil');
  assert.equal(restored.clubId,original.clubId);
  assert.equal(restored.version,5);
  assert.ok(sanitizePlayerCareer(restored,clubs));
});


test('trial creates a bounded youth contract without letting the user choose the initial club directly',function(){
  const signed=finishTrial(createPlayerCareer({name:'Contrato Base',position:'MEI',archetype:'creator',dreamClubId:clubs[0].id},2026));
  assert.ok(signed.clubId);
  assert.ok(signed.contract);
  assert.equal(signed.contract.kind,'youth');
  assert.equal(signed.contract.clubId,signed.clubId);
  assert.ok(signed.contract.salaryMonthly>=2500);
  assert.ok(signed.contract.expirySeason>signed.season);
});

test('player match approach is a persistent bounded decision independent from training focus',function(){
  let career=finishTrial(createPlayerCareer({name:'Postura',position:'ATA',archetype:'finisher',dreamClubId:clubs[3].id},2026));
  career=setPlayerMatchApproach(career,'aggressive');
  assert.equal(career.matchApproach,'aggressive');
  assert.equal(career.trainingFocus,'balanced');
  const advanced=simulatePlayerWeek(career,clubs);
  assert.equal(advanced.matchApproach,'aggressive');
  assert.ok(advanced.player.condition>=35&&advanced.player.condition<=100);
});

test('player save sanitizer clamps extended career and contract fields',function(){
  const signed=finishTrial(createPlayerCareer({name:'Sanitize',position:'DEF',archetype:'strong',dreamClubId:clubs[4].id},2026));
  const bad={...signed,matchApproach:'hack',nationalTeamStatus:'god',contract:{...signed.contract,salaryMonthly:Infinity,expirySeason:9999},player:{...signed.player,morale:999,condition:-20,coachTrust:999,reputation:-5},awards:Array.from({length:100},(_,i)=>({id:'a'+i}))};
  const clean=sanitizePlayerCareer(bad,clubs);
  assert.equal(clean.matchApproach,'balanced');
  assert.equal(clean.nationalTeamStatus,'none');
  assert.equal(clean.player.morale,100);
  assert.equal(clean.player.condition,35);
  assert.equal(clean.player.coachTrust,100);
  assert.equal(clean.player.reputation,1);
  assert.ok(clean.contract.expirySeason<=2110);
  assert.equal(clean.awards.length,60);
});

test('daily and weekly simulation use the same deterministic calendar engine',function(){
  const base=finishTrial(createPlayerCareer({name:'Calendário',position:'MEI',archetype:'creator',dreamClubId:clubs[5].id},2026));
  let daily=base;
  for(let i=0;i<7;i++)daily=simulatePlayerDay(daily,clubs);
  const weekly=simulatePlayerWeek(base,clubs);
  assert.equal(daily.dayOfSeason,7);
  assert.equal(weekly.dayOfSeason,7);
  assert.equal(daily.week,weekly.week);
  assert.deepEqual(daily.lastMatch,weekly.lastMatch);
  assert.deepEqual(daily.seasonStats,weekly.seasonStats);
  assert.equal(daily.player.condition,weekly.player.condition);
});

test('player match results are generated from team strength xG and bounded Poisson outcomes',function(){
  let career=finishTrial(createPlayerCareer({name:'Partida Engine',position:'ATA',archetype:'finisher',dreamClubId:clubs[6].id},2026));
  for(let i=0;i<6;i++)career=simulatePlayerDay(career,clubs);
  assert.ok(career.lastMatch);
  assert.ok(Array.isArray(career.lastMatch.xg));
  assert.equal(career.lastMatch.xg.length,2);
  assert.ok(career.lastMatch.xg.every(value=>value>=.15&&value<=4));
  assert.ok(career.lastMatch.goalsFor>=0&&career.lastMatch.goalsFor<=8);
  assert.ok(career.lastMatch.goalsAgainst>=0&&career.lastMatch.goalsAgainst<=8);
});

test('player career remains bounded over a long multi-season simulation',function(){
  let career=finishTrial(createPlayerCareer({name:'Carreira Longa',position:'GOL',archetype:'technical',dreamClubId:clubs[7].id},2026));
  for(let i=0;i<900&&career.stage!=='retired';i++)career=simulatePlayerWeek(career,clubs);
  assert.ok(career.age>=20);
  assert.ok(career.player.condition>=35&&career.player.condition<=100);
  assert.ok(career.player.morale>=0&&career.player.morale<=100);
  assert.ok(career.player.coachTrust>=0&&career.player.coachTrust<=100);
  assert.ok(career.player.reputation>=1&&career.player.reputation<=100);
  assert.ok(career.dayOfSeason>=0&&career.dayOfSeason<=266);
  assert.ok(JSON.stringify(career).length<500000);
});


test('career offers expire when the decision window passes',function(){
  let career=finishTrial(createPlayerCareer({name:'Prazo',position:'MEI',archetype:'technical',dreamClubId:clubs[8].id},2026));
  career={...career,dayOfSeason:7,week:1,pendingOffer:{id:'expired',clubId:clubs[9].id,clubName:clubs[9].name,expiresWeek:0,status:'open'}};
  const next=simulatePlayerDay(career,clubs);
  assert.equal(next.pendingOffer,null);
  assert.ok(next.news.some(item=>item.title==='Proposta expirada'));
});

test('achievement popup queue preserves consecutive career moments',function(){
  let career=finishTrial(createPlayerCareer({name:'Momentos',position:'ATA',archetype:'finisher',dreamClubId:clubs[10].id},2026));
  career={...career,pendingMoment:{id:'one',type:'milestone',title:'Um',subtitle:'',text:'Primeiro',season:2026,day:1},momentQueue:[{id:'two',type:'goal',title:'Dois',subtitle:'',text:'Segundo',season:2026,day:2}]};
  career=acknowledgePlayerMoment(career);
  assert.equal(career.pendingMoment.id,'two');
  assert.equal(career.momentQueue.length,0);
  career=acknowledgePlayerMoment(career);
  assert.equal(career.pendingMoment,null);
});


test('RC7 player career exposes market value objectives and position metrics after matches',function(){
  let career=finishTrial(createPlayerCareer({name:'Inteligência',position:'MEI',archetype:'creator',dreamClubId:clubs[0].id},2026));
  assert.ok(career.player.marketValue>=150000);
  assert.ok(playerObjectiveSnapshot(career).length>=2);
  for(let i=0;i<6;i++)career=simulatePlayerDay(career,clubs);
  assert.ok(career.lastMatch);
  if(career.lastMatch.performance){
    assert.ok(career.lastMatch.performance.metrics);
    assert.ok('passesCompleted' in career.lastMatch.performance.metrics);
  }
  assert.ok(career.player.marketValue>=150000&&career.player.marketValue<=250000000);
});

test('contract renewal can be accepted or refused and expiry creates a free agent',function(){
  let career=finishTrial(createPlayerCareer({name:'Contrato RC6',position:'DEF',archetype:'strong',dreamClubId:clubs[2].id},2026));
  career={...career,stage:'professional',dayOfSeason:220,week:31,contract:{...career.contract,kind:'pro',expirySeason:2027,salaryMonthly:25000},pendingContractOffer:{id:'renew-test',clubId:career.clubId,clubName:career.contract.clubName,salaryMonthly:33000,years:3,role:'Disputa posição',expiresDay:250}};
  const renewed=respondPlayerContractOffer(career,true);
  assert.equal(renewed.contract.expirySeason,2029);
  assert.equal(renewed.contract.salaryMonthly,33000);
  assert.equal(renewed.pendingContractOffer,null);

  let leaving={...career,pendingContractOffer:{...career.pendingContractOffer}};
  leaving=respondPlayerContractOffer(leaving,false);
  assert.equal(leaving.contractIntent,'leave');
  leaving={...leaving,dayOfSeason:265,week:37};
  leaving=simulatePlayerDay(leaving,clubs);
  assert.equal(leaving.season,2027);
  assert.equal(leaving.stage,'free-agent');
  assert.equal(leaving.contract,null);
  assert.equal(leaving.clubId,null);
});

test('legacy v2 portable player saves migrate to RC7 without corrupting identity',function(){
  const original=finishTrial(createPlayerCareer({name:'Migração V2',position:'GOL',archetype:'technical',dreamClubId:clubs[4].id},2026));
  const legacy={...original,version:2};delete legacy.teamSeason;delete legacy.objectives;delete legacy.careerEvents;delete legacy.pendingContractOffer;delete legacy.performanceHistory;delete legacy.player.marketValue;
  const raw=JSON.stringify({signature:'linha-de-frente-player-save',fileVersion:2,exportedAt:new Date(0).toISOString(),career:legacy});
  const migrated=parsePlayerCareer(raw,clubs);
  assert.equal(migrated.version,5);
  assert.equal(migrated.player.name,'Migração V2');
  assert.ok(Array.isArray(migrated.objectives));
  assert.ok(migrated.teamSeason);
  assert.ok(Number.isFinite(migrated.player.marketValue));
});


test('RC7 new careers remove facial creation and store a real personality modifier',function(){
  const career=createPlayerCareer({name:'Sem Rosto',position:'MEI',archetype:'technical',personalityId:'competitive',dreamClubId:clubs[0].id},2026);
  assert.equal(career.player.face,undefined);
  assert.equal(career.player.personalityId,'competitive');
  assert.equal(career.version,5);
});

test('RC7 migrates legacy face data without using it as an active creator field',function(){
  const original=finishTrial(createPlayerCareer({name:'Legado Facial',position:'ATA',archetype:'fast',dreamClubId:clubs[1].id},2026));
  const legacy={...original,version:3,player:{...original.player,face:{skin:2,hair:4,hairColor:1,eyes:3,shape:2}}};
  const raw=JSON.stringify({signature:'linha-de-frente-player-save',fileVersion:3,exportedAt:new Date(0).toISOString(),career:legacy});
  const migrated=parsePlayerCareer(raw,clubs);
  assert.equal(migrated.version,5);
  assert.equal(migrated.player.face,undefined);
  assert.deepEqual(migrated.player.legacyFace,{skin:2,hair:4,hairColor:1,eyes:3,shape:2});
});

test('RC7 agenda exposes recovery training tactical preparation match and rest days',function(){
  const career=finishTrial(createPlayerCareer({name:'Agenda RC7',position:'DEF',archetype:'strong',dreamClubId:clubs[2].id},2026));
  const agenda=playerAgendaSnapshot(career);
  assert.equal(agenda.length,7);
  const types=new Set(agenda.map(item=>item.type));
  for(const type of ['recovery','training','tactical','preparation','match','rest'])assert.ok(types.has(type),type+' missing');
});

test('advance until next match uses the same daily simulation path',function(){
  const career=finishTrial(createPlayerCareer({name:'Até Jogo',position:'MEI',archetype:'creator',dreamClubId:clubs[3].id},2026));
  const advanced=simulatePlayerUntilNextMatch(career,clubs);
  assert.ok(advanced.dayOfSeason>=1&&advanced.dayOfSeason<=7);
  assert.ok(advanced.liveMatch||advanced.lastMatch||advanced.dayOfWeek===5);
});

test('RC7 squad hierarchy exposes coach rivalry and deterministic starter probability',function(){
  const career=finishTrial(createPlayerCareer({name:'Concorrência',position:'ATA',archetype:'finisher',personalityId:'professional',dreamClubId:clubs[4].id},2026));
  const first=playerSquadCompetitionSnapshot(career,clubs),second=playerSquadCompetitionSnapshot(career,clubs);
  assert.ok(first.coach?.name);
  assert.ok(first.coachProfile?.name);
  assert.equal(first.rivals.length,3);
  assert.ok(first.starterChance>=.03&&first.starterChance<=.96);
  assert.deepEqual(first,second);
});

test('contract preference and one-round agent negotiation affect renewal state',function(){
  let career=finishTrial(createPlayerCareer({name:'Negociador',position:'MEI',archetype:'technical',personalityId:'ambitious',dreamClubId:clubs[5].id},2026));
  career={...career,stage:'professional',dayOfSeason:220,week:31,contract:{...career.contract,kind:'pro',expirySeason:2027,salaryMonthly:30000},pendingContractOffer:{id:'renew-rc7',clubId:career.clubId,clubName:career.contract.clubName,salaryMonthly:42000,signingBonus:60000,years:3,role:'Rotação',expiresDay:250,negotiated:false}};
  career=setPlayerContractPreference(career,'starter');
  assert.equal(career.contractPreference,'starter');
  const negotiated=negotiatePlayerContractOffer(career,'role');
  assert.equal(negotiated.pendingContractOffer.negotiated,true);
  assert.ok(['accepted','rejected'].includes(negotiated.pendingContractOffer.negotiationResult));
  const repeated=negotiatePlayerContractOffer(negotiated,'salary');
  assert.deepEqual(repeated.pendingContractOffer,negotiated.pendingContractOffer);
});

test('post-match state stores briefing coach review timeline and role-specific feedback',function(){
  let career=finishTrial(createPlayerCareer({name:'Jogo Vivo',position:'MEI',archetype:'creator',personalityId:'competitive',dreamClubId:clubs[6].id},2026));
  for(let i=0;i<7&&!career.lastMatch;i++)career=simulatePlayerDay(career,clubs);
  assert.ok(career.lastMatch);
  assert.ok(career.lastMatch.briefing);
  assert.ok(career.lastMatch.coachReview);
  assert.ok(Array.isArray(career.lastMatch.timeline));
  assert.ok(career.lastMatch.timeline.some(item=>item.type==='fulltime'));
  if(career.lastMatch.performance)assert.ok(career.lastMatch.performance.metrics);
});


test('RC7 can move a player into an abstract international club and preserve it through save restore',function(){
  let career=finishTrial(createPlayerCareer({name:'Europa RC7',position:'ATA',archetype:'finisher',personalityId:'ambitious',dreamClubId:clubs[0].id},2026));
  career={...career,stage:'professional',finance:{...career.finance,cash:500000},pendingOffer:{id:'benfica-test',kind:'transfer',clubId:'pc-benfica',clubName:'Benfica',country:'POR',league:'Liga Portugal',interestScore:82,marketValue:18000000,role:'Disputa posição',salaryMonthly:160000,signingBonus:240000,years:4,expiresWeek:career.week+3,dreamClub:false}};
  const moved=respondPlayerOffer(career,clubs,true);
  assert.equal(moved.clubId,'pc-benfica');
  assert.equal(moved.contract.clubName,'Benfica');
  assert.equal(moved.world.leagueCountry,'POR');
  assert.ok(moved.finance.cash>=740000);
  const restored=parsePlayerCareer(serializePlayerCareer(moved),clubs);
  assert.equal(restored.clubId,'pc-benfica');
  assert.equal(restored.world.leagueName,'Liga Portugal');
});


test('RC7 interactive match pauses the calendar and applies live behavior changes to the remaining phases',function(){
  let career=finishTrial(createPlayerCareer({name:'Ao Vivo RC7',position:'ATA',archetype:'finisher',personalityId:'competitive',dreamClubId:clubs[8].id},2026));
  career=simulatePlayerUntilNextMatch(career,clubs);
  assert.ok(career.liveMatch,'next-match advance should open the live player match');
  assert.equal(career.liveMatch.minute,0);
  const initialEnergy=career.liveMatch.energy;
  career=setPlayerLiveApproach(career,'aggressive');
  assert.equal(career.liveMatch.currentApproach,'aggressive');
  career=advancePlayerLiveMatch(career,clubs);
  assert.equal(career.liveMatch?.minute,15);
  if(career.liveMatch?.active)assert.ok(career.liveMatch.energy<=initialEnergy);
  const saved=parsePlayerCareer(serializePlayerCareer(career),clubs);
  assert.equal(saved.liveMatch?.minute,15);
  assert.equal(saved.liveMatch?.currentApproach,'aggressive');
  career=simulatePlayerLiveMatchToEnd(saved,clubs);
  assert.equal(career.liveMatch,null);
  assert.ok(career.lastMatch);
  assert.equal(career.lastMatch.interactive,true);
  assert.ok(career.lastMatch.timeline.some(item=>item.type==='fulltime'));
  assert.ok(career.lastMatch.individualObjective);
});

test('weekly simulation remains available as an automatic alternative to the interactive match',function(){
  const base=finishTrial(createPlayerCareer({name:'Semana Automática',position:'DEF',archetype:'strong',personalityId:'professional',dreamClubId:clubs[9].id},2026));
  const advanced=simulatePlayerWeek(base,clubs);
  assert.equal(advanced.liveMatch,null);
  assert.ok(advanced.dayOfSeason>=7||advanced.season>base.season);
  assert.ok(advanced.lastMatch);
});
