import { playerAvailability, playerGameStats } from './player-engine.js';
import { positionGroup, translatePosition } from './position-labels.js';
import { aiPlanVector } from './tactical-engine.js';

const clamp=(min,max,n)=>Math.max(min,Math.min(max,Number(n)||0));
function mean(list,fn){return list.length?list.reduce((s,x)=>s+fn(x),0)/list.length:0;}
function matchForClub(result,clubId){
  const home=String(result.homeId)===String(clubId);
  return{gf:home?result.homeGoals:result.awayGoals,ga:home?result.awayGoals:result.homeGoals,home};
}
function scorerGoals(career,clubId,limit=5){
  return Object.values(career?.scorers||{}).filter(x=>String(x.clubId)===String(clubId)).sort((a,b)=>b.goals-a.goals).slice(0,limit);
}
export function opponentScoutingReport(career,opponent,roundNumber=(career?.round||0)+1){
  if(!opponent)return null;
  const players=opponent.players||[],defenders=players.filter(p=>positionGroup(p.position)==='DEF'),mids=players.filter(p=>positionGroup(p.position)==='MEI'),attackers=players.filter(p=>positionGroup(p.position)==='ATA');
  const recent=(career?.results||[]).filter(r=>String(r.homeId)===String(opponent.id)||String(r.awayId)===String(opponent.id)).slice(-5);
  const form=recent.map(r=>{const x=matchForClub(r,opponent.id);return x.gf>x.ga?'V':x.gf===x.ga?'E':'D';});
  const wins=form.filter(x=>x==='V').length,goalsFor=recent.reduce((s,r)=>s+matchForClub(r,opponent.id).gf,0),goalsAgainst=recent.reduce((s,r)=>s+matchForClub(r,opponent.id).ga,0);
  const unavailable=players.map(player=>({player,availability:playerAvailability(career,opponent.id,player,roundNumber)})).filter(x=>!x.availability.available);
  const defendersAvailable=defenders.filter(player=>playerAvailability(career,opponent.id,player,roundNumber).available);
  const aerialDefense=mean(defendersAvailable,p=>playerGameStats(p).defending*.62+playerGameStats(p).composure*.22+clamp(0,15,(Number(p.heightCm||180)-175))*.9);
  const recoveryPace=mean(defendersAvailable,p=>playerGameStats(p).pace);
  const buildUpResistance=mean([...defendersAvailable,...mids].slice(0,10),p=>playerGameStats(p).passing*.62+playerGameStats(p).composure*.38);
  const attackingPace=mean(attackers,p=>playerGameStats(p).pace);
  const attackQuality=mean(attackers,p=>playerGameStats(p).shooting*.58+playerGameStats(p).composure*.25+playerGameStats(p).pace*.17);
  const topScorers=scorerGoals(career,opponent.id,3),threat=topScorers[0]||null;
  const inferredPlan=wins>=4?'pressing':goalsAgainst>=8?'vertical':goalsFor<=3?'compact':'balanced',plan=aiPlanVector(inferredPlan);
  const weaknesses=[],strengths=[],suggestions=[];
  if(aerialDefense<68){weaknesses.push('A defesa apresenta vulnerabilidade pelo alto.');suggestions.push({key:'setPieces',label:'Bola parada',action:'Priorize 2º poste/área cheia e um bom alvo aéreo.'});}
  if(recoveryPace<66){weaknesses.push('A última linha tem recuperação lenta.');suggestions.push({key:'directness',label:'Transição',action:'Aumente jogo direto ou ative contra-ataque para atacar as costas.'});}
  if(buildUpResistance<68){weaknesses.push('A saída curta perde qualidade sob pressão.');suggestions.push({key:'pressing',label:'Pressão',action:'Pressão alta pode gerar recuperações perto da área.'});}
  if(goalsAgainst>=7){weaknesses.push('A equipe sofreu muitos gols nos últimos cinco jogos.');}
  if(attackingPace>=76){strengths.push('Ataque veloz: linha muito alta aumenta o risco de contra-ataque.');suggestions.push({key:'defensiveLine',label:'Linha defensiva',action:'Evite subir a linha sem cobertura se estiver protegendo vantagem.'});}
  if(attackQuality>=75)strengths.push('O ataque tem boa combinação de finalização, velocidade e compostura.');
  if(wins>=4)strengths.push('Chega em forte sequência: '+wins+' vitórias nos últimos '+recent.length+' jogos.');
  if(threat)strengths.push(threat.name+' é o principal goleador do adversário no campeonato ('+threat.goals+' gols).');
  for(const item of unavailable.slice(0,3))weaknesses.push(item.player.name+' ('+translatePosition(item.player.position)+') está fora: '+item.availability.reasons.join(', ')+'.');
  return{
    opponentId:String(opponent.id),form,wins,goalsFor,goalsAgainst,
    unavailable:unavailable.map(x=>({id:String(x.player.id),name:x.player.name,position:translatePosition(x.player.position),reasons:x.availability.reasons})),
    topScorers,strengths,weaknesses,suggestions,
    metrics:{aerialDefense:Math.round(aerialDefense||0),recoveryPace:Math.round(recoveryPace||0),buildUpResistance:Math.round(buildUpResistance||0),attackingPace:Math.round(attackingPace||0),attackQuality:Math.round(attackQuality||0)},
    inferredPlan:{id:inferredPlan,...plan},
  };
}
