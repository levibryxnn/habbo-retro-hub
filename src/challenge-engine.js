const clamp=(min,max,n)=>Math.max(min,Math.min(max,n));
export const CAREER_CHALLENGES=[
  {id:'normal',name:'Carreira livre',description:'Sem restrições extras. O desafio vem do clube, calendário e mercado.'},
  {id:'brazil-only',name:'Raízes brasileiras',description:'Contratações e empréstimos de entrada apenas de jogadores brasileiros.'},
  {id:'academy-core',name:'DNA da base',description:'A carreira valoriza usar e desenvolver jogadores promovidos da base.'},
  {id:'no-signings',name:'Reconstrução interna',description:'Sem compras ou empréstimos de entrada na primeira temporada.'},
  {id:'survival',name:'Missão permanência',description:'A prioridade absoluta da primeira temporada é evitar o rebaixamento.'},
];
export const careerChallenge=id=>CAREER_CHALLENGES.find(item=>item.id===id)||CAREER_CHALLENGES[0];
export function transferAllowedByChallenge(career,player,offerType){
  const id=career?.careerChallenge||'normal';
  if(id==='no-signings'&&Number(career.season||2026)===Number(career.challengeStartSeason||career.season||2026)&&['buy','loan-in'].includes(offerType))return{ok:false,reason:'O desafio Reconstrução interna bloqueia contratações na primeira temporada.'};
  if(id==='brazil-only'&&['buy','loan-in'].includes(offerType)&&String(player?.countryCode||'BRA').toUpperCase()!=='BRA')return{ok:false,reason:'O desafio Raízes brasileiras permite contratar apenas jogadores brasileiros.'};
  return{ok:true};
}
export function challengeSeasonResult(career,review){
  const id=career?.careerChallenge||'normal';if(id==='normal')return null;
  if(id==='survival'){
    const success=Number(review?.position||20)<=16;return{id,success,label:success?'Missão cumprida: permanência':'Missão não cumprida',score:success?100:25};
  }
  if(id==='academy-core'){
    const youthKeys=new Set((career.regens||[]).filter(player=>String(player._originClubId)===String(career.userClubId)&&String(player.id||'').startsWith('youth-')).map(player=>String(player.id)));
    const appearances=Object.values(career.seasonPerformance||{}).filter(item=>youthKeys.has(String(item.playerId))&&Number(item.appearances||0)>=5).length,success=appearances>=2;
    return{id,success,label:success?'A base virou parte do time':'A base ainda teve pouco espaço',score:clamp(0,100,appearances*45)};
  }
  if(id==='no-signings'){
    const start=Number(career.challengeStartSeason||career.season),incoming=(career.transferHistory||[]).filter(item=>Number(item.season)===start&&['buy','loan-in'].includes(item.type)&&String(item.toClubId)===String(career.userClubId));
    const success=incoming.length===0;return{id,success,label:success?'Reconstrução interna respeitada':'Restrição de mercado quebrada',score:success?100:0};
  }
  if(id==='brazil-only'){
    return{id,success:true,label:'Política de mercado mantida pela engine',score:100};
  }
  return null;
}
