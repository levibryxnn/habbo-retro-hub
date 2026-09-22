export const INITIAL_CASH = 20000000;
export const slots = { master:'Patrocínio máster', sleeve:'Mangas', training:'Uniforme de treino' };

export const offers = [
  {
    id:'vertice', name:'VÉRTICE', sector:'Tecnologia', slot:'master', color:'#536ca4', tagline:'O futuro veste a sua camisa.',
    payment:{ type:'monthly', label:'Mensal', amount:800000, signingBonus:1500000 },
    requirement:{ type:'reputation', value:65, label:'Reputação do clube ≥ 65' },
  },
  {
    id:'aurora', name:'AURORA', sector:'Energia', slot:'master', color:'#b08142', tagline:'Energia para ir mais longe.',
    payment:{ type:'upfront', label:'À vista', amount:9500000, signingBonus:0 },
    requirement:{ type:'position', value:8, minRound:5, label:'Estar no G8 após a 5ª rodada' },
  },
  {
    id:'pulso', name:'PULSO', sector:'Mobilidade', slot:'sleeve', color:'#ae6260', tagline:'Sempre em movimento.',
    payment:{ type:'per_match', label:'Por rodada', amount:120000, signingBonus:250000 },
    requirement:{ type:'squad', value:25, label:'Elenco com pelo menos 25 atletas' },
  },
  {
    id:'nexo', name:'NEXO', sector:'Conectividade', slot:'sleeve', color:'#6c5d9e', tagline:'Conectados pela mesma paixão.',
    payment:{ type:'quarterly', label:'Parcelas trimestrais', amount:1900000, signingBonus:600000 },
    requirement:{ type:'position', value:12, minRound:5, label:'Estar no top 12 após a 5ª rodada' },
  },
  {
    id:'orbe', name:'ORBE', sector:'Equipamentos esportivos', slot:'training', color:'#467a79', tagline:'Cada treino constrói uma vitória.',
    payment:{ type:'monthly', label:'Mensal', amount:220000, signingBonus:300000 },
    requirement:{ type:'squad', value:22, label:'Elenco com pelo menos 22 atletas' },
  },
  {
    id:'impulso', name:'IMPULSO', sector:'Nutrição esportiva', slot:'training', color:'#78874d', tagline:'Preparação que faz a diferença.',
    payment:{ type:'performance', label:'Performance', amount:60000, winBonus:150000, signingBonus:0 },
    requirement:{ type:'wins', value:3, label:'Conquistar 3 vitórias na temporada' },
  },
];

const paymentRounds = {
  monthly:[4,8,12,16,20,24,28,32,36,38],
  quarterly:[10,20,30,38],
};

export function offerById(id) {
  return offers.find(function(offer){ return offer.id === id; });
}

export function clubReputation(club) {
  const players = club?.players || [];
  const depth = Math.min(players.length, 40);
  const internationals = new Set(players.map(function(player){ return player.countryCode; }).filter(Boolean)).size;
  const prime = players.filter(function(player){
    const age = player.age ?? 27;
    return age >= 23 && age <= 30;
  }).length;
  return Math.max(45, Math.min(85, 48 + Math.round(depth * .65) + Math.min(8, internationals) + Math.min(6, Math.round(prime / 5))));
}

export function sponsorContext(career, club, standing) {
  const table = standing || [];
  const row = table.find(function(item){ return item.clubId === career.userClubId; });
  return {
    round: career.round || 0,
    position: row?.position ?? 20,
    wins: row?.wins ?? 0,
    reputation: clubReputation(club),
    squadSize: club?.players?.length ?? 0,
  };
}

export function requirementStatus(offer, context) {
  const req = offer.requirement;
  if (!req) return { ok:true, label:'Sem requisito adicional' };
  if (req.type === 'reputation') return { ok:context.reputation >= req.value, label:req.label };
  if (req.type === 'squad') return { ok:context.squadSize >= req.value, label:req.label };
  if (req.type === 'wins') return { ok:context.wins >= req.value, label:req.label };
  if (req.type === 'position') {
    if (context.round < req.minRound) return { ok:false, label:req.label + ' · disponível após a rodada ' + req.minRound };
    return { ok:context.position <= req.value, label:req.label };
  }
  return { ok:false, label:req.label || 'Requisito não atendido' };
}

export function activeContracts(career) {
  return (career.sponsors || []).filter(function(contract){ return contract.active !== false; }).map(function(contract){
    return { ...contract, offer:offerById(contract.offerId) };
  }).filter(function(contract){ return Boolean(contract.offer); });
}

export function projectedOfferValue(offer, round) {
  const currentRound = round || 0;
  const remaining = Math.max(0, 38 - currentRound);
  if (offer.payment.type === 'upfront') return offer.payment.amount + offer.payment.signingBonus;
  if (offer.payment.type === 'per_match') return offer.payment.signingBonus + offer.payment.amount * remaining;
  if (offer.payment.type === 'performance') return offer.payment.signingBonus + offer.payment.amount * remaining;
  const rounds = (paymentRounds[offer.payment.type] || []).filter(function(item){ return item > currentRound; }).length;
  return offer.payment.signingBonus + offer.payment.amount * rounds;
}

function addTransaction(career, amount, label, round, kind) {
  const transactionKind = kind || 'sponsor';
  const count = career.transactions?.length || 0;
  return {
    ...career,
    cash:(career.cash ?? INITIAL_CASH) + amount,
    transactions:[
      { id:transactionKind + '-' + round + '-' + count, round, amount, label, kind:transactionKind },
      ...(career.transactions || []),
    ].slice(0,80),
  };
}

export function signSponsor(career, offerId, club, standing) {
  const offer = offerById(offerId);
  if (!offer) return { career, error:'Proposta inválida.' };
  if (activeContracts(career).some(function(contract){ return contract.offer.slot === offer.slot; })) {
    return { career, error:'Este espaço já possui patrocinador.' };
  }
  const status = requirementStatus(offer, sponsorContext(career, club, standing || []));
  if (!status.ok) return { career, error:status.label };
  const contract = { offerId, signedRound:career.round || 0, active:true, totalReceived:0, paidRounds:[] };
  let next = { ...career, sponsors:[...(career.sponsors || []), contract] };
  const immediate = (offer.payment.signingBonus || 0) + (offer.payment.type === 'upfront' ? offer.payment.amount : 0);
  if (immediate > 0) {
    next = addTransaction(next, immediate, offer.name + ' · assinatura', career.round || 0);
    next = {
      ...next,
      sponsors:next.sponsors.map(function(item){
        return item.offerId === offerId && item.signedRound === contract.signedRound
          ? { ...item, totalReceived:immediate }
          : item;
      }),
    };
  }
  return { career:next, error:null };
}

export function endSponsor(career, offerId) {
  return {
    ...career,
    sponsors:(career.sponsors || []).map(function(contract){
      return contract.offerId === offerId && contract.active !== false
        ? { ...contract, active:false, endedRound:career.round }
        : contract;
    }),
  };
}

export function applySponsorPayments(career, round, userResult) {
  let next = career;
  const views = activeContracts(next);
  for (const contractView of views) {
    const offer = contractView.offer;
    const source = (next.sponsors || []).find(function(contract){
      return contract.offerId === offer.id && contract.active !== false;
    });
    if (!source || source.paidRounds?.includes(round) || round <= source.signedRound) continue;
    let amount = 0;
    if (offer.payment.type === 'per_match') amount = offer.payment.amount;
    if (offer.payment.type === 'performance') {
      amount = offer.payment.amount;
      if (userResult?.winner === 'user') amount += offer.payment.winBonus || 0;
    }
    if ((offer.payment.type === 'monthly' || offer.payment.type === 'quarterly') && (paymentRounds[offer.payment.type] || []).includes(round)) {
      amount = offer.payment.amount;
    }
    if (amount <= 0) continue;
    next = addTransaction(next, amount, offer.name + ' · ' + offer.payment.label, round);
    next = {
      ...next,
      sponsors:(next.sponsors || []).map(function(contract){
        return contract.offerId === source.offerId && contract.signedRound === source.signedRound && contract.active !== false
          ? { ...contract, totalReceived:(contract.totalReceived || 0) + amount, paidRounds:[...(contract.paidRounds || []), round] }
          : contract;
      }),
    };
  }
  return next;
}

export function expireSeasonSponsors(career) {
  return {
    ...career,
    sponsors:(career.sponsors || []).map(function(contract){
      return contract.active === false ? contract : { ...contract, active:false, endedRound:38, expired:true };
    }),
  };
}

export function sponsorshipTotals(career) {
  const active = activeContracts(career);
  return {
    active:active.length,
    received:(career.sponsors || []).reduce(function(sum,contract){ return sum + (contract.totalReceived || 0); },0),
    projected:active.reduce(function(sum,contract){ return sum + projectedOfferValue(contract.offer, career.round); },0),
  };
}
