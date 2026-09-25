import { getClubWorld, rivalryLevel } from './club-world.js';
import { playerGameStats } from './player-engine.js';
import { applyConfidenceEvent } from './manager-confidence.js';
import { initialTransferBudget, resetSeasonTransferBudget, transferBudgetSnapshot } from './economy-engine.js';
import { emitCareerEvent } from './event-engine.js';
import { newsworthiness, rivalryScore, scoutedPotentialRange } from './ldf-engine.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
const hash=value=>{let h=2166136261;for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const roll=seed=>(hash(seed)%1000000)/1000000;
const pick=(list,seed)=>list[hash(seed)%list.length];

export const MANAGER_PROFILES=[
  {id:'strategist',name:'Estrategista',description:'Pequena vantagem de preparação e leitura de jogo.',matchEdge:.035,morale:1,board:1,transfer:.98,youth:1},
  {id:'motivator',name:'Motivador',description:'Vestiário reage melhor a vitórias e absorve melhor derrotas.',matchEdge:.01,morale:1.28,board:.95,transfer:1,youth:1},
  {id:'developer',name:'Formador',description:'Potencializa base, jovens e paciência com atletas em evolução.',matchEdge:.01,morale:1.05,board:1,transfer:1,youth:1.16},
  {id:'negotiator',name:'Negociador',description:'Melhor ambiente em negociações, vendas e reinvestimento.',matchEdge:0,morale:1,board:1.03,transfer:.94,youth:1},
  {id:'manager',name:'Gestor',description:'Maior estabilidade financeira e relação com a diretoria.',matchEdge:0,morale:1,board:1.18,transfer:.98,youth:1.02},
];
export const managerProfile=id=>MANAGER_PROFILES.find(item=>item.id===id)||MANAGER_PROFILES[0];

const PRESIDENTS=[
  {id:'patient',name:'Conselho paciente',riskTolerance:.72,finance:.92,pressure:.82,description:'Valoriza estabilidade e projetos de médio prazo.'},
  {id:'ambitious',name:'Presidência ambiciosa',riskTolerance:1.18,finance:1.08,pressure:1.22,description:'Aceita investir mais, mas cobra resultados rapidamente.'},
  {id:'prudent',name:'Diretoria prudente',riskTolerance:.78,finance:.78,pressure:.94,description:'Controla gastos e premia decisões financeiramente sustentáveis.'},
  {id:'football',name:'Presidência boleira',riskTolerance:1.04,finance:1,pressure:1.02,description:'Dá peso extra ao futebol, clássicos e conquistas.'},
  {id:'developer',name:'Presidência formadora',riskTolerance:.88,finance:.92,pressure:.92,description:'Aceita crescimento gradual quando a base e o patrimônio evoluem.'},
];
export function presidentForClub(clubId,season=2026){return PRESIDENTS[hash(String(clubId)+'|'+Math.floor((season-2026)/4))%PRESIDENTS.length];}
export function clubDNAFor(clubId){
  const w=getClubWorld(clubId),big=(w.fanIndex||.5)>.82,rich=(w.gameBudgetM||0)>=65;
  const academy=(w.marketTotalEurM||0)<80?1.15:1;
  return{
    id:String(clubId),
    labels:[
      big?'Pressão por protagonismo':'Crescimento sustentável',
      rich?'Ambição continental':'Eficiência de mercado',
      academy>1?'Espaço para a base':'Elenco competitivo',
    ],
    youthWeight:academy,
    titlePressure:big?1.18:.9,
    financeWeight:rich?.92:1.08,
  };
}
function playerKey(clubId,player){return String(player._playerKey||String(player._originClubId||clubId)+':'+player.id);}
function leadersFor(club){
  return (club?.players||[]).slice().sort((a,b)=>{
    const ao=playerGameStats(a).overall,bo=playerGameStats(b).overall;
    return (bo+(b.age||27)*.06)-(ao+(a.age||27)*.06);
  }).slice(0,4).map(p=>({key:playerKey(club.id,p),name:p.name}));
}
export function squadHierarchyFor(club,career=null){
  const ranked=(club?.players||[]).slice().sort((a,b)=>{
    const ao=playerGameStats(a).overall,bo=playerGameStats(b).overall,aa=Number(a._careerAge??a.age??27),ba=Number(b._careerAge??b.age??27);
    const aKey=playerKey(club.id,a),bKey=playerKey(club.id,b),aMood=career?.dressingRoom?.playerMood?.[aKey]||{},bMood=career?.dressingRoom?.playerMood?.[bKey]||{};
    return(bo+Math.min(35,ba)*.075+Number(bMood.managerTrust||60)*.012)-(ao+Math.min(35,aa)*.075+Number(aMood.managerTrust||60)*.012);
  });
  const hierarchy={};
  ranked.forEach((player,index)=>{
    const age=Number(player._careerAge??player.age??27),key=playerKey(club.id,player),tier=index<4?'leader':index<11?'core':age<=21?'prospect':'rotation',baseInfluence=tier==='leader'?1.35:tier==='core'?1.10:tier==='rotation'?.82:.68,mood=career?.dressingRoom?.playerMood?.[key]||{};
    const leadership=clamp(30,95,42+playerGameStats(player).composure*.45+Math.max(0,age-22)*1.2+(tier==='leader'?10:0));
    const clubAttachment=clamp(20,95,55+Math.min(12,Math.max(0,age-20))*1.5+(String(player._originClubId||club.id)===String(club.id)?10:0));
    const managerTrust=clamp(0,100,Number(mood.managerTrust??60)),playingTimeSatisfaction=clamp(0,100,Number(mood.morale??78)),contractSatisfaction=clamp(0,100,Number(mood.contractSatisfaction??70));
    const influence=Number(clamp(.55,1.55,baseInfluence+(leadership-60)*.004).toFixed(2));
    hierarchy[key]={key,playerId:String(player.id),name:player.name,tier,influence,overall:playerGameStats(player).overall,leadership:Math.round(leadership),managerTrust:Math.round(managerTrust),playingTimeSatisfaction:Math.round(playingTimeSatisfaction),contractSatisfaction:Math.round(contractSatisfaction),clubAttachment:Math.round(clubAttachment),captain:index===0};
  });
  return hierarchy;
}
function seedNews(career,club){
  return[{id:'news-opening-'+career.season,season:career.season,round:0,type:'club',importance:2,title:'Novo trabalho começa no '+club.name,text:(career.managerName||'O novo treinador')+' inicia a temporada com o elenco, a diretoria e a torcida observando os primeiros passos.',timestamp:career.season+'-01-01'}];
}
function generateProspects(career,club,count=5){
  const first=['Caio','João','Lucas','Rafael','Gabriel','Matheus','Pedro','Arthur','Nicolas','Samuel','Bruno','Henrique','Murilo','Gustavo','Davi','Theo'];
  const last=['Silva','Souza','Oliveira','Santos','Lima','Pereira','Rocha','Moura','Almeida','Costa','Ferreira','Vieira','Ribeiro','Cardoso','Nunes'];
  const positions=['Goalkeeper','Defender','Defender','Midfielder','Midfielder','Forward'];
  const profile=managerProfile(career.managerProfile),dna=clubDNAFor(club.id),level=clamp(1,5,Number(career.facilities?.academy)||Number(career.youthAcademy?.level)||Math.round(1+(getClubWorld(club.id).fanIndex||.5)*2+(getClubWorld(club.id).gameBudgetM||20)/75));
  return Array.from({length:count},(_,i)=>{
    const seed=career.season+'|'+club.id+'|academy|'+i,name=pick(first,seed+'f')+' '+pick(last,seed+'l'),age=16+(hash(seed+'age')%3),position=positions[hash(seed+'pos')%positions.length];
    const base=47+Math.floor(roll(seed+'base')*(11+level*2)),talent=roll(seed+'talent');
    const tier=talent<.55?'common':talent<.82?'interesting':talent<.95?'great':talent<.99?'wonderkid':'exceptional';
    const bonus={common:5,interesting:11,great:18,wonderkid:25,exceptional:31}[tier],variance=Math.floor(roll(seed+'pot')*(tier==='exceptional'?7:9)),rawPotential=base+bonus+variance+(level-1)*1.2;
    const potential=clamp(base+3,96,Math.round(rawPotential*profile.youth*dna.youthWeight));
    return{id:'academy-'+career.season+'-'+i+'-'+hash(seed).toString(36),name,age,position,overall:clamp(45,68,base),potential,talentTier:tier,status:'academy',scouted:0,createdSeason:career.season};
  });
}
function deriveCareerRecord(career){
  const league=(career.history||[]).map(item=>item.points),world=(career.world?.history||[]).filter(item=>String(item.homeId)===String(career.userClubId)||String(item.awayId)===String(career.userClubId)).map(item=>{const home=String(item.homeId)===String(career.userClubId),gf=home?item.homeGoals:item.awayGoals,ga=home?item.awayGoals:item.homeGoals;return gf>ga?3:gf===ga?1:0;}),points=[...league,...world];
  return{matches:points.length,wins:points.filter(v=>v===3).length,draws:points.filter(v=>v===1).length,losses:points.filter(v=>v===0).length,seen:[]};
}
export function initializeCareerSystems(career,club,clubs=[]){
  if(career.systemsVersion>=1&&career.dressingRoom&&career.careerMemory&&career.careerRecord&&career.dressingRoom.hierarchy)return career;
  if(career.systemsVersion>=1&&career.dressingRoom&&career.careerMemory&&career.careerRecord)return{...career,dressingRoom:{...career.dressingRoom,hierarchy:squadHierarchyFor(club,career)}};
  const president=presidentForClub(club.id,career.season),dna=clubDNAFor(club.id),leaders=leadersFor(club);
  return{
    ...career,
    systemsVersion:1,
    managerProfile:career.managerProfile||'strategist',
    managerReputation:Number.isFinite(career.managerReputation)?career.managerReputation:50,
    presidentProfile:career.presidentProfile||president,
    clubDNA:career.clubDNA||dna,
    transferBudget:Number.isFinite(Number(career.transferBudget))?Number(career.transferBudget):initialTransferBudget(club.id),
    dressingRoom:career.dressingRoom||{morale:82,unity:78,leaders,hierarchy:squadHierarchyFor(club,career),playerMood:{}},
    fanCredit:Number.isFinite(career.fanCredit)?career.fanCredit:0,
    careerMemory:career.careerMemory||{streak:{type:'none',count:0},bestWin:null,rivalries:{},historicMoments:[],milestones:[]},
    newsFeed:Array.isArray(career.newsFeed)&&career.newsFeed.length?career.newsFeed:seedNews(career,club),
    pressConference:career.pressConference||null,
    youthAcademy:career.youthAcademy||{level:clamp(1,5,Math.round(1+(getClubWorld(club.id).fanIndex||.5)*2)),prospects:generateProspects(career,club),lastIntakeSeason:career.season},
    scouting:career.scouting||{level:1,reports:{}},
    hallOfFame:career.hallOfFame||{players:[],moments:[]},
    careerRecord:career.careerRecord||deriveCareerRecord(career),
    financialEvents:Array.isArray(career.financialEvents)?career.financialEvents:[],
    universeNotes:Array.isArray(career.universeNotes)?career.universeNotes:[],
  };
}
function addNews(career,item){
  if(!item)return career;
  const exists=(career.newsFeed||[]).some(n=>n.id===item.id);
  if(exists)return career;
  return{...career,newsFeed:[item,...(career.newsFeed||[])].slice(0,80)};
}
function addMoment(career,moment){
  if(!moment)return career;
  const memory=career.careerMemory||{historicMoments:[]};
  if((memory.historicMoments||[]).some(x=>x.id===moment.id))return career;
  return{...career,careerMemory:{...memory,historicMoments:[moment,...(memory.historicMoments||[])].slice(0,60)}};
}
function applyMilestone(career,{id,title,text,importance=3,type='milestone'}){
  const memory=career.careerMemory||{streak:{type:'none',count:0},bestWin:null,rivalries:{},historicMoments:[],milestones:[]},milestones=Array.isArray(memory.milestones)?memory.milestones:[];
  if(milestones.some(item=>item.id===id))return career;
  const item={id,season:career.season,round:career.round,title,text,type};
  let next={...career,careerMemory:{...memory,milestones:[item,...milestones].slice(0,60)}};
  next=addMoment(next,{...item,type:'milestone'});
  return addNews(next,{id:'news-'+id,season:career.season,round:career.round,type,importance,title,text,timestamp:String(career.season)+'-r'+String(career.round)});
}
function updateCareerMilestones(career){
  let next=career,record=career.careerRecord||{matches:0,wins:0},matches=Number(record.matches||0),wins=Number(record.wins||0),titles=(career.trophies||[]).length;
  const matchMarks=[1,50,100,250,500],winMarks=[1,50,100,250],titleMarks=[1,5,10];
  for(const mark of matchMarks)if(matches>=mark)next=applyMilestone(next,{id:'manager-matches-'+mark,title:mark===1?'Primeiro jogo no comando':mark+' jogos como treinador',text:mark===1?'A carreira oficialmente começou à beira do campo.':'O treinador alcançou '+mark+' partidas oficiais no universo deste save.'});
  for(const mark of winMarks)if(wins>=mark)next=applyMilestone(next,{id:'manager-wins-'+mark,title:mark===1?'Primeira vitória da carreira':mark+' vitórias alcançadas',text:mark===1?'O primeiro resultado positivo entrou para a memória da carreira.':'A carreira chegou a '+mark+' vitórias oficiais.'});
  for(const mark of titleMarks)if(titles>=mark)next=applyMilestone(next,{id:'manager-titles-'+mark,title:mark===1?'Primeiro título da carreira':mark+' títulos conquistados',text:mark===1?'A primeira taça passa a fazer parte do legado do treinador.':'O treinador alcançou '+mark+' conquistas no save.',importance:4,type:'title'});
  return next;
}
function resultInfo(result,userClubId){
  if(!result)return null;const home=String(result.homeId)===String(userClubId),gf=home?result.homeGoals:result.awayGoals,ga=home?result.awayGoals:result.homeGoals,opponentId=home?result.awayId:result.homeId;
  return{home,gf,ga,opponentId,outcome:gf>ga?'win':gf<ga?'loss':'draw',margin:gf-ga};
}
function updateStreak(memory,outcome){
  const type=outcome==='win'?'wins':outcome==='loss'?'losses':'draws',old=memory?.streak||{type:'none',count:0};
  return{...memory,streak:{type,count:old.type===type?old.count+1:1}};
}
function updateRivalry(career,info,result,clubs){
  const memory=career.careerMemory||{},map={...(memory.rivalries||{})},id=String(info.opponentId),historic=rivalryLevel(career.userClubId,id)*24,current=map[id]||{score:historic,meetings:0,userWins:0,opponentWins:0,draws:0,knockouts:0,finals:0,controversies:0,lastSeason:career.season};
  const stage=String(result.stage||''),knockout=/Final|Semifinal|Quartas|Oitavas|Playoff/i.test(stage),final=/Final/i.test(stage),redCount=(result.events||[]).filter(e=>e.type==='red').length,meetings=current.meetings+1,knockouts=Number(current.knockouts||0)+(knockout?1:0),finals=Number(current.finals||0)+(final?1:0),controversies=Number(current.controversies||0)+Math.min(2,redCount);
  const score=rivalryScore({historicBase:historic,matches:meetings,knockouts,finals,titleBattles:final?1:0,controversies,derbyFactor:rivalryLevel(career.userClubId,id)>=2?1:0});
  const next={...current,score,meetings,knockouts,finals,controversies,userWins:current.userWins+(info.outcome==='win'?1:0),opponentWins:current.opponentWins+(info.outcome==='loss'?1:0),draws:current.draws+(info.outcome==='draw'?1:0),lastSeason:career.season};
  map[id]=next;return{...career,careerMemory:{...memory,rivalries:map}};
}
function updatePlayerMood(career,club,result){
  const room=career.dressingRoom||{morale:80,unity:75,leaders:[],hierarchy:squadHierarchyFor(club,career),playerMood:{}},hierarchy=squadHierarchyFor(club,career),mood={...(room.playerMood||{})},side=String(result.homeId)===String(club.id)?'home':'away',lineupIds=(side==='home'?result.homeLineup:result.awayLineup)||[];
  if(!lineupIds.length)return career;
  const lineup=new Set(lineupIds.map(String)),ranked=(club.players||[]).slice().sort((a,b)=>playerGameStats(b).overall-playerGameStats(a).overall).slice(0,16);
  let unity=Number(room.unity??75);
  for(const player of ranked){
    const key=playerKey(club.id,player),old=mood[key]||{benchStreak:0,morale:78},influence=Number(hierarchy[key]?.influence||1),tier=hierarchy[key]?.tier||'rotation';
    const started=lineup.has(String(player.id)),benchStreak=started?0:old.benchStreak+1,benchPenalty=benchStreak>=3?-3.2*influence:0,morale=clamp(20,100,old.morale+(started?1.2:benchPenalty));
    const unhappyThreshold=tier==='leader'?3:4,requestThreshold=tier==='leader'?5:6;
    if(!started&&benchStreak>=unhappyThreshold&&influence>=1.1)unity=clamp(20,100,unity-.35*influence);
    mood[key]={...old,key,name:player.name,tier,influence,benchStreak,morale,unhappy:benchStreak>=unhappyThreshold&&playerGameStats(player).overall>=70,wantsTransfer:benchStreak>=requestThreshold&&playerGameStats(player).overall>=72};
  }
  return{...career,dressingRoom:{...room,hierarchy,unity,playerMood:mood}};
}
function maybeFinancialEvent(career){
  if(![7,15,23,31].includes(Number(career.round)))return career;
  if((career.financialEvents||[]).some(e=>e.season===career.season&&e.round===career.round))return career;
  const seed=career.season+'|'+career.userClubId+'|finance|'+career.round,r=roll(seed),pres=career.presidentProfile||presidentForClub(career.userClubId,career.season);
  let amount=0,title,text,kind;
  if(r<.28){amount=-Math.round((700000+roll(seed+'a')*1800000)*pres.finance/100000)*100000;title='Custo extraordinário no clube';text='Manutenção e operação consumiram parte do caixa nesta janela.';kind='expense';}
  else if(r>.76){amount=Math.round((900000+roll(seed+'b')*2400000)/100000)*100000;title='Receita comercial extraordinária';text='Uma ativação comercial e o bom momento geraram receita adicional.';kind='income';}
  else return career;
  const event={id:'finance-'+career.season+'-'+career.round,season:career.season,round:career.round,title,text,amount,kind};
  const next={...career,cash:Number(career.cash||0)+amount,transactions:[{id:event.id,round:career.round,amount,label:title,kind:'club-event'},...(career.transactions||[])].slice(0,140),financialEvents:[event,...(career.financialEvents||[])].slice(0,30)};
  return addNews(next,{id:'news-'+event.id,season:career.season,round:career.round,type:'finance',importance:2,title,text:text+' Impacto no caixa: '+(amount>0?'+':'')+Math.round(amount/1000000*10)/10+' mi.',timestamp:String(career.season)+'-r'+String(career.round)});
}
export function applyMatchDynamics(career,club,clubs,result,{competition='Brasileirão Série A',stage=''}={}){
  if(!result||!club)return career;
  let next=initializeCareerSystems(career,club,clubs),info=resultInfo(result,next.userClubId);if(!info)return next;
  const record=next.careerRecord||deriveCareerRecord(next),resultKey=String(result.id||result.fixtureId||next.season+'-'+next.round+'-'+result.homeId+'-'+result.awayId),alreadyRecorded=(record.seen||[]).includes(resultKey);
  if(!alreadyRecorded)next={...next,careerRecord:{matches:(record.matches||0)+1,wins:(record.wins||0)+(info.outcome==='win'?1:0),draws:(record.draws||0)+(info.outcome==='draw'?1:0),losses:(record.losses||0)+(info.outcome==='loss'?1:0),seen:[resultKey,...(record.seen||[])].slice(0,120)}};
  const profile=managerProfile(next.managerProfile),room=next.dressingRoom||{},memory=updateStreak(next.careerMemory,info.outcome);
  let moraleDelta=info.outcome==='win'?3.2:info.outcome==='draw'?.4:-3.4;if(moraleDelta>0)moraleDelta*=profile.morale;else if(profile.id==='motivator')moraleDelta*=.72;
  const unityDelta=info.outcome==='win'?.7:info.outcome==='loss'?-.8:0;
  next={...next,dressingRoom:{...room,morale:clamp(20,100,(room.morale??82)+moraleDelta),unity:clamp(20,100,(room.unity??78)+unityDelta)},careerMemory:memory,managerReputation:clamp(1,100,(next.managerReputation??50)+(info.outcome==='win'?(.28+Math.max(0,72-Number(result.intelligence?.homeStrength||result.homePower||72))*.006):info.outcome==='loss'?-.22:.04))};
  next=updateRivalry(next,info,{...result,stage},clubs);
  next=updatePlayerMood(next,club,result);
  for(const mood of Object.values(next.dressingRoom?.playerMood||{}).filter(item=>item.wantsTransfer)){
    next=addNews(next,{id:'news-transfer-request-'+next.season+'-'+mood.key,season:next.season,round:next.round,type:'dressing-room',importance:3,title:mood.name+' quer mais espaço no time',text:'A sequência fora dos titulares incomodou o jogador. Sem mudança de cenário, uma saída passa a ser considerada.',timestamp:String(next.season)+'-r'+String(next.round)});
  }
  const opp=clubs.find(c=>String(c.id)===String(info.opponentId)),clubName=club.name,oppName=opp?.name||'adversário';
  const headline=info.outcome==='win'?pick([clubName+' confirma bom momento',clubName+' soma vitória importante',clubName+' faz valer o trabalho'],result.id+'w'):info.outcome==='loss'?pick([clubName+' deixa pontos pelo caminho',clubName+' terá de reagir',clubName+' sofre revés na temporada'],result.id+'l'):clubName+' empata com '+oppName;
  const expectedGap=Math.abs(Number(result.intelligence?.homeStrength||result.homePower||0)-Number(result.intelligence?.awayStrength||result.awayPower||0)),underdogWin=info.outcome==='win'&&((info.home&&Number(result.intelligence?.homeStrength||0)<Number(result.intelligence?.awayStrength||0))||(!info.home&&Number(result.intelligence?.awayStrength||0)<Number(result.intelligence?.homeStrength||0))),rivalLevel=rivalryLevel(next.userClubId,info.opponentId),newsScore=newsworthiness({importance:/Final/i.test(stage)?5:/Semifinal/i.test(stage)?4:2,surprise:underdogWin?Math.min(1,expectedGap/20):0,rivalry:rivalLevel*25,streak:Number(memory.streak?.count||0),playerImpact:Math.abs(info.margin)>=3?1:0,historicalContext:/Final/i.test(stage)?1:0});
  if(newsScore>=3.2)next=addNews(next,{id:'news-match-'+result.id,season:next.season,round:next.round,type:'match',importance:/Final|Semifinal/i.test(stage)?4:2,title:headline,text:clubName+' '+(info.outcome==='win'?'venceu':info.outcome==='loss'?'perdeu':'empatou')+' com '+oppName+' por '+info.gf+' a '+info.ga+' em '+competition+(stage?' · '+stage:'')+'.',timestamp:String(next.season)+'-r'+String(next.round),newsScore});
  const injuries=(result.events||[]).filter(e=>e.type==='injury'&&String(e.clubId)===String(next.userClubId));
  for(const injury of injuries)next=addNews(next,{id:'news-injury-'+result.id+'-'+injury.playerId,season:next.season,round:next.round,type:'injury',importance:injury.severityMatches>=3?4:2,title:injury.player+' vira preocupação no departamento médico',text:(injury.injuryLabel||'Lesão')+' pode tirá-lo de até '+(injury.severityMatches||1)+' partidas e reduzir seu rendimento durante a recuperação.',timestamp:String(next.season)+'-r'+String(next.round)});
  if(memory.streak.type==='wins'&&memory.streak.count>=3)next=addNews(next,{id:'news-streak-'+next.season+'-'+next.round,season:next.season,round:next.round,type:'form',importance:3,title:clubName+' embala '+memory.streak.count+' vitórias seguidas',text:'A sequência começa a mudar a percepção sobre o trabalho e aumenta a confiança ao redor do clube.',timestamp:String(next.season)+'-r'+String(next.round)});
  if(Math.abs(info.margin)>=4)next=addMoment(next,{id:'moment-'+result.id,season:next.season,round:next.round,type:'score',title:(info.margin>0?'Grande goleada':'Noite difícil')+' contra '+oppName,text:info.gf+'–'+info.ga+' em '+competition});
  const rivalry=next.careerMemory?.rivalries?.[String(info.opponentId)];
  if(rivalry?.score>=60&&rivalry.meetings>=3)next=addNews(next,{id:'news-rivalry-'+next.season+'-'+info.opponentId+'-'+rivalry.meetings,season:next.season,round:next.round,type:'rivalry',importance:3,title:'Um novo capítulo de rivalidade com '+oppName,text:'Confrontos frequentes e decisivos transformaram este duelo em uma rivalidade importante dentro do seu save.',timestamp:String(next.season)+'-r'+String(next.round)});
  const credit=Math.max(0,Number(next.fanCredit||0));if(info.outcome==='loss'&&credit>0)next=applyConfidenceEvent(next,{fans:Math.min(1.8,credit*.08),kind:'legacy',reason:'O histórico recente do treinador ainda lhe dá crédito com parte da torcida.'});
  if(profile.id==='strategist'&&info.outcome==='win')next=applyConfidenceEvent(next,{board:.4,kind:'profile',reason:'A diretoria reconheceu a preparação tática do treinador.'});
  if(profile.id==='motivator'&&info.outcome==='win')next=applyConfidenceEvent(next,{fans:.5,kind:'profile',reason:'O ambiente positivo do vestiário se refletiu nas arquibancadas.'});
  if(profile.id==='manager'&&info.outcome==='loss')next=applyConfidenceEvent(next,{board:.45,kind:'profile',reason:'A organização do projeto preservou parte da confiança da diretoria após o resultado.'});
  const president=next.presidentProfile||presidentForClub(next.userClubId,next.season),dna=next.clubDNA||clubDNAFor(next.userClubId);
  if(info.outcome==='loss'&&president.id==='ambitious')next=applyConfidenceEvent(next,{board:-.6*president.pressure,kind:'board-style',reason:'A presidência ambiciosa elevou a cobrança após o resultado.'});
  if(info.outcome==='loss'&&president.id==='patient')next=applyConfidenceEvent(next,{board:.45,kind:'board-style',reason:'A diretoria manteve respaldo ao projeto apesar do resultado.'});
  if(info.outcome==='win'&&dna.titlePressure>1.1)next=applyConfidenceEvent(next,{fans:.25,kind:'club-dna',reason:'A vitória respondeu à cultura de protagonismo que cerca o clube.'});
  if((next.cash||0)<0&&president.id==='prudent')next=applyConfidenceEvent(next,{board:-.7,kind:'finance',reason:'A diretoria prudente demonstrou preocupação com o caixa negativo.'});
  const pressure=(next.careerMemory?.streak?.type==='losses'&&next.careerMemory.streak.count>=3)||rivalryLevel(next.userClubId,info.opponentId)>=2||/Final|Semifinal/i.test(stage);
  if(pressure&&!next.pressConference)next={...next,pressConference:{id:'press-'+next.season+'-'+next.round,season:next.season,round:next.round,reason:rivalryLevel(next.userClubId,info.opponentId)>=2?'clássico':/Final|Semifinal/i.test(stage)?'decisão':'sequência ruim',opponent:oppName,choices:[
    {id:'protect',label:'Proteger o elenco',copy:'Assumir a responsabilidade e tirar pressão dos jogadores.'},
    {id:'demand',label:'Cobrar reação',copy:'Aumentar publicamente a exigência por desempenho.'},
    {id:'calm',label:'Manter serenidade',copy:'Evitar manchetes e tratar o momento com equilíbrio.'},
  ]}};
  next=maybeFinancialEvent(next);
  next=updateCareerMilestones(next);
  return next;
}
export function resolvePressConference(career,choiceId){
  if(!career.pressConference)return career;let next={...career,pressHistory:[{...career.pressConference,choice:choiceId},...(career.pressHistory||[])].slice(0,30),pressConference:null};
  if(choiceId==='protect'){next={...next,dressingRoom:{...next.dressingRoom,morale:clamp(20,100,(next.dressingRoom?.morale??80)+3),unity:clamp(20,100,(next.dressingRoom?.unity??75)+2)}};next=applyConfidenceEvent(next,{fans:.7,board:-.2,kind:'press',reason:'Você protegeu o elenco publicamente.'});}
  if(choiceId==='demand'){next={...next,dressingRoom:{...next.dressingRoom,morale:clamp(20,100,(next.dressingRoom?.morale??80)-2),unity:clamp(20,100,(next.dressingRoom?.unity??75)-1)}};next=applyConfidenceEvent(next,{fans:.2,board:1,kind:'press',reason:'Você aumentou a cobrança pública por desempenho.'});}
  if(choiceId==='calm')next=applyConfidenceEvent(next,{fans:.2,board:.2,kind:'press',reason:'Você evitou alimentar a pressão externa.'});
  return emitCareerEvent(next,{type:'PRESS_CONFERENCE',importance:2,payload:{choice:choiceId}});

}
export function managerMatchModifier(career){
  const p=managerProfile(career?.managerProfile),morale=Number(career?.dressingRoom?.morale??80),unity=Number(career?.dressingRoom?.unity??75);
  return clamp(-.08,.10,p.matchEdge+(morale-75)*.0007+(unity-75)*.0005);
}
export function scoutRange(career,player,key){
  const exact=playerGameStats(player).overall,report=career.scouting?.reports?.[key],level=Number(career.facilities?.scouting||career.scouting?.level||1),views=Number(report?.views||0);
  const certainty=clamp(35,100,45+level*8+views*15);
  const spread=Math.max(0,6-level-views),drift=Math.round((roll(key+'|'+career.season)-.5)*Math.max(1,spread));
  const potential=Number(player?._potential??career.playerDevelopment?.[key]?.potential??exact+Math.max(2,20-Math.max(0,Number(player?._careerAge??player?.age??25)-18)));
  const potentialView=scoutedPotentialRange(potential,{scoutingLevel:level,observations:views,seed:key+'|'+career.season});
  return{min:certainty>=90?exact:clamp(40,94,exact-spread+drift),max:certainty>=90?exact:clamp(40,94,exact+spread+drift),certainty:certainty>=90?100:certainty,exact:certainty>=90,potentialMin:potentialView.min,potentialMax:potentialView.max,potentialExact:potentialView.exact,potentialCertainty:potentialView.certainty};
}
export function observePlayer(career,key,player){
  const reports={...(career.scouting?.reports||{})},old=reports[key]||{views:0,certainty:35};reports[key]={views:(old.views||0)+1,certainty:clamp(35,100,(old.certainty||35)+22),lastSeason:career.season,name:player.name};
  return{...career,scouting:{...(career.scouting||{level:1}),reports}};
}
export function promoteAcademyProspect(career,club,prospectId){
  const academy=career.youthAcademy;if(!academy)return career;const prospect=(academy.prospects||[]).find(p=>p.id===prospectId&&p.status==='academy');if(!prospect)return career;
  const id='youth-'+hash(career.season+'|'+prospect.id).toString(36),key=String(club.id)+':'+id,player={id,name:prospect.name,age:prospect.age,position:prospect.position,nationality:'Brazil',countryCode:'BRA',_generatedOverall:prospect.overall,_potential:prospect.potential,_generation:2,_rootName:prospect.name,_careerAge:prospect.age,_baseAge:prospect.age,_originClubId:String(club.id),_playerKey:key};
  let next={...career,regens:[...(career.regens||[]),player],playerDevelopment:{...(career.playerDevelopment||{}),[key]:{age:prospect.age,baseAge:prospect.age,baseOverall:prospect.overall,delta:0,potential:prospect.potential,generation:2,rootName:prospect.name,position:prospect.position,createdSeason:career.season}},youthAcademy:{...academy,prospects:academy.prospects.map(p=>p.id===prospectId?{...p,status:'promoted'}:p)},newsFeed:[{id:'news-youth-'+prospect.id,season:career.season,round:career.round,type:'academy',importance:2,title:prospect.name+' sobe para o profissional',text:'A comissão decidiu promover uma promessa da base para trabalhar com o elenco principal.',timestamp:String(career.season)+'-r'+String(career.round)},...(career.newsFeed||[])]};
  if(managerProfile(career.managerProfile).id==='developer')next=applyConfidenceEvent(next,{board:.6,fans:.3,kind:'academy',reason:'O perfil formador do treinador reforçou o compromisso do clube com a base.'});
  const promotedCount=(next.regens||[]).filter(p=>String(p._originClubId)===String(club.id)&&String(p.id||'').startsWith('youth-')).length;
  if(promotedCount===1)next=applyMilestone(next,{id:'first-youth-promotion',title:'Primeiro talento promovido da base',text:prospect.name+' foi o primeiro jogador da base promovido pelo treinador neste save.',importance:3,type:'academy'});
  return emitCareerEvent(next,{type:'YOUTH_PROMOTED',playerId:id,importance:3,payload:{name:prospect.name,overall:prospect.overall,potential:prospect.potential}});

}
export function applyTransferDynamics(career,{type,playerName,playerKey:nullKey=null,amount=0,marketValue=0,fromUser=false,toUser=false}={}){
  let next=career,room=next.dressingRoom||{morale:80,unity:75,leaders:[]},profile=managerProfile(next.managerProfile);
  if(type==='sell'&&fromUser){
    const member=nullKey?room.hierarchy?.[nullKey]:null,influence=Number(member?.influence||.8),leader=member?.tier==='leader'||member?.captain;
    const ripple=leader?clamp(2,8,2.4*influence):0;
    const moods={...(room.playerMood||{})};
    if(leader)for(const [key,value] of Object.entries(room.hierarchy||{})){if(key===nullKey||Number(value.influence||0)<1)continue;const old=moods[key]||{name:value.name,morale:76,managerTrust:60};moods[key]={...old,morale:clamp(20,100,(old.morale??76)-ripple*.45),managerTrust:clamp(0,100,(old.managerTrust??60)-ripple*.35),leaderSaleReaction:true};}
    room={...room,unity:clamp(20,100,(room.unity??75)-(amount<marketValue*.85?3:1)-ripple),morale:clamp(20,100,(room.morale??80)-ripple*.45),playerMood:moods};
  }
  if(type==='buy'&&toUser){room={...room,morale:clamp(20,100,(room.morale??80)+(amount<=marketValue?2:1))};next={...next,managerReputation:clamp(1,100,(next.managerReputation??50)+(profile.id==='negotiator'?.7:.3))};}
  next={...next,dressingRoom:room};
  const verb=type==='sell'?'negocia saída de':type==='buy'?'acerta contratação de':type.includes('loan')?'fecha empréstimo de':'movimenta o mercado com';
  next=addNews(next,{id:'news-transfer-'+next.season+'-'+next.round+'-'+hash(type+'|'+playerName+'|'+amount),season:next.season,round:next.round,type:'transfer',importance:2,title:(next.managerName||'Clube')+' '+verb+' '+playerName,text:'O negócio movimentou '+Math.round(Number(amount||0)/1_000_000)+' milhões de reais e terá impacto esportivo e financeiro no projeto.',timestamp:String(next.season)+'-r'+String(next.round)});
  if(type==='sell'&&fromUser&&Number(amount)>=100_000_000)next=applyMilestone(next,{id:'sale-100m-'+hash(playerName+'|'+amount),title:'Venda de nove dígitos',text:playerName+' deixou o clube por '+Math.round(Number(amount)/1_000_000)+' milhões de reais, um negócio que entrou para a história financeira do save.',importance:4,type:'transfer'});
  return updateCareerMilestones(next);
}
export function applyTitleDynamics(career,trophy){
  let next={...career,fanCredit:clamp(0,30,(career.fanCredit||0)+8),managerReputation:clamp(1,100,(career.managerReputation??50)+5)};
  next=addMoment(next,{id:'title-'+trophy.id+'-'+career.season,season:career.season,round:career.round,type:'title',title:'Campeão: '+trophy.name,text:'Título conquistado na temporada '+career.season+'.'});
  next=addNews(next,{id:'news-title-'+trophy.id+'-'+career.season,season:career.season,round:career.round,type:'title',importance:5,title:(career.managerName||'Treinador')+' coloca o clube no topo',text:'O título de '+trophy.name+' entra para a história do save e amplia o crédito do treinador com torcida e diretoria.',timestamp:String(career.season)+'-r'+String(career.round)});
  next=emitCareerEvent(next,{type:'TITLE_WON',importance:5,payload:{id:trophy.id,name:trophy.name}});
  return updateCareerMilestones(next);
}
export function applySeasonDynamics(career,club,previousReview=career.seasonReview){
  let next=career,review=previousReview||{},previousSeason=Number(review.season||career.season-1),hof={...(career.hallOfFame||{players:[],moments:[]})};
  if(review.bestPlayer&&review.bestPlayer.appearances>=8&&!hof.players.some(p=>p.name===review.bestPlayer.name&&p.season===previousSeason))hof.players=[{name:review.bestPlayer.name,season:previousSeason,rating:review.bestPlayer.averageRating,goals:review.bestPlayer.goals,reason:'Destaque da temporada'},...hof.players].slice(0,30);
  hof.moments=[...(career.careerMemory?.historicMoments||[]).filter(m=>m.season===previousSeason),...(hof.moments||[])].slice(0,50);
  const newSeason=career.season,president=presidentForClub(club.id,newSeason);
  const academy={...(career.youthAcademy||{}),prospects:generateProspects(career,club,4+Math.floor(roll(club.id+'|'+newSeason+'intake')*3)),lastIntakeSeason:newSeason};
  const budgetCareer={...career,seasonReview:review};
  next={...next,hallOfFame:hof,presidentProfile:president,youthAcademy:academy,transferBudget:resetSeasonTransferBudget(budgetCareer),fanCredit:clamp(0,30,(career.fanCredit||0)*.88+(review.position<=4?3:review.position<=8?1:0)),managerReputation:clamp(1,100,(career.managerReputation??50)+(review.position<=4?2:review.position>=17?-2:.5))};
  for(const retirement of next.pendingRetirements||[])next=addNews(next,{id:'news-retirement-'+retirement.id,season:newSeason,round:0,type:'retirement',importance:3,title:retirement.name+' encerra a carreira',text:'Aos '+retirement.age+' anos, o jogador deixa os gramados. '+retirement.successorName+' aparece na base como parte da nova geração.',timestamp:newSeason+'-01-01'});
  return addNews(next,{id:'news-preseason-'+newSeason,season:newSeason,round:0,type:'club',importance:2,title:'Novo ciclo começa no '+club.name,text:'Diretoria, base e elenco foram reavaliados para a temporada '+newSeason+'. O mercado e as metas refletem o que aconteceu no ano anterior.',timestamp:newSeason+'-01-01'});
}
export function managerCareerSummary(career){
  const record=career.careerRecord||deriveCareerRecord(career),wins=record.wins||0,draws=record.draws||0,losses=record.losses||0;
  const biggest=(career.careerMemory?.historicMoments||[]).find(m=>m.type==='score');
  const buys=(career.transferHistory||[]).filter(t=>t.type==='buy'),sales=(career.transferHistory||[]).filter(t=>t.type==='sell');
  const allTitles=[...(career.managerTrophies||[]),...(career.trophies||[])],clubsManaged=Math.max(1,(career.managerClubHistory||[]).length);
  return{seasons:Math.max(1,(career.seasons||[]).length+(career.round>0?1:0)),matches:wins+draws+losses,wins,draws,losses,titles:allTitles.length,clubsManaged,reputation:Math.round(career.managerReputation??50),biggest,biggestBuy:buys.sort((a,b)=>b.amount-a.amount)[0]||null,biggestSale:sales.sort((a,b)=>b.amount-a.amount)[0]||null};
}
function eventNewsItem(event){
  const p=event.payload||{},base={id:'event-news-'+event.id,season:event.season,round:event.round,timestamp:event.timestamp,importance:event.importance||2,type:'career'};
  if(event.type==='PROMISE_BROKEN')return{...base,type:'dressing-room',title:'Promessa quebrada com '+(p.name||'jogador'),text:'O compromisso de '+(p.promise||'gestão do elenco')+' não foi cumprido e o vestiário registrou a decisão.'};
  if(event.type==='PROMISE_FULFILLED')return{...base,type:'dressing-room',title:'Compromisso cumprido com '+(p.name||'jogador'),text:'A relação com o atleta melhorou após o treinador cumprir o que havia prometido.'};
  if(event.type==='FACILITY_UPGRADED')return{...base,type:'club',title:'Clube investe na estrutura',text:'A área de '+p.type+' avançou para o nível '+p.level+' após investimento de '+Math.round(Number(p.cost||0)/1e6)+' milhões de reais.'};
  if(event.type==='CONTRACT_RENEWED')return{...base,type:'contract',title:(p.name||'Jogador')+' renova contrato',text:'O novo vínculo foi acertado por '+(p.years||3)+' temporadas.'};
  if(event.type==='JOB_OFFERED')return{...base,type:'manager',title:(p.clubName||'Outro clube')+' procura o treinador',text:'A reputação do trabalho abriu uma possibilidade de '+String(p.project||'novo projeto').toLowerCase()+'.'};
  if(event.type==='MANAGER_CHANGED_CLUB')return{...base,type:'manager',importance:5,title:'Novo capítulo: '+(p.clubName||'novo clube'),text:'O treinador aceitou mudar de projeto e a linha do tempo da carreira foi atualizada.'};
  if(event.type==='PROJECT_OBJECTIVE_COMPLETED')return{...base,type:'board',title:'Meta de projeto cumprida',text:p.label||'A diretoria reconheceu o avanço do projeto.'};
  if(event.type==='PROJECT_OBJECTIVE_MISSED')return{...base,type:'board',title:'Meta de projeto fica pendente',text:p.label||'A diretoria registrou uma meta não cumprida.'};
  if(event.type==='CHALLENGE_COMPLETED'||event.type==='CHALLENGE_MISSED')return{...base,type:'challenge',title:p.label||'Desafio de carreira atualizado',text:'O modo de carreira registrou o desempenho no desafio escolhido.'};
  if(event.type==='YOUTH_PROMOTED')return{...base,type:'academy',title:(p.name||'Jovem')+' ganha espaço no profissional',text:'A promoção da base entrou para o histórico do projeto.'};
  return null;
}
export function careerNews(career){
  const universe=(career.universeNotes||[]).map(item=>({...item,importance:item.importance||2,round:item.round||0,timestamp:item.date||item.timestamp||String(item.season),type:item.type||'universe'})),events=(career.eventLedger||[]).map(eventNewsItem).filter(Boolean);
  const merged=[...(career.newsFeed||[]),...events,...universe],seen=new Set();
  return merged.filter(item=>{if(!item?.id||seen.has(item.id))return false;seen.add(item.id);return true;}).sort((a,b)=>Number(b.season)-Number(a.season)||Number(b.round||0)-Number(a.round||0));
}
export function dynamicRivalries(career,clubs){
  return Object.entries(career.careerMemory?.rivalries||{}).map(([clubId,data])=>({clubId,name:clubs.find(c=>String(c.id)===clubId)?.name||clubId,...data,label:data.score>=75?'Rivalidade intensa':data.score>=55?'Rivalidade recente':data.score>=35?'Confronto quente':'Histórico normal'})).sort((a,b)=>b.score-a.score);
}
export function difficultyProfile(career,club){
  const w=getClubWorld(club.id),finance=transferBudgetSnapshot(career),pressure=(career.clubDNA?.titlePressure||1),squad=(club.players||[]).reduce((sum,p)=>sum+playerGameStats(p).overall,0)/Math.max(1,(club.players||[]).length);
  const score=clamp(1,100,54+(70-squad)*1.15+(35-finance.budget/1_000_000)*.65+(pressure-1)*22-(w.fanIndex-.5)*8);
  return{score:Math.round(score),label:score>=68?'Projeto difícil':score>=48?'Desafio equilibrado':'Estrutura forte'};
}
