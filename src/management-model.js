export const STORAGE_KEY = 'ldf.management.v1';
export const slots = { master: 'Patrocínio máster', sleeve: 'Mangas', training: 'Uniforme de treino' };
// Fictional laboratory proposals, unrelated to actual club finances or sponsors.
export const offers = [
  { id:'vertice', name:'VÉRTICE', sector:'Tecnologia', slot:'master', monthly:600000, months:12, bonus:0, color:'#536ca4', tagline:'O futuro veste a sua camisa.' },
  { id:'aurora', name:'AURORA', sector:'Energia', slot:'master', monthly:500000, months:24, bonus:1200000, color:'#b08142', tagline:'Energia para ir mais longe.' },
  { id:'pulso', name:'PULSO', sector:'Mobilidade', slot:'sleeve', monthly:180000, months:12, bonus:100000, color:'#ae6260', tagline:'Sempre em movimento.' },
  { id:'nexo', name:'NEXO', sector:'Conectividade', slot:'sleeve', monthly:210000, months:24, bonus:0, color:'#6c5d9e', tagline:'Conectados pela mesma paixão.' },
  { id:'orbe', name:'ORBE', sector:'Equipamentos esportivos', slot:'training', monthly:120000, months:12, bonus:80000, color:'#467a79', tagline:'Cada treino constrói uma vitória.' },
  { id:'impulso', name:'IMPULSO', sector:'Nutrição esportiva', slot:'training', monthly:140000, months:24, bonus:0, color:'#78874d', tagline:'Preparação que faz a diferença.' },
];
export const trophies = [
  {id:'brasileirao',name:'Brasileirão Série A',kind:'Nacional',label:'O topo do futebol brasileiro',shape:'league'},
  {id:'copa',name:'Copa do Brasil',kind:'Nacional',label:'Uma taça. Todo o país.',shape:'cup'},
  {id:'libertadores',name:'CONMEBOL Libertadores',kind:'Continental',label:'A América espera por você',shape:'globe'},
  {id:'sulamericana',name:'CONMEBOL Sul-Americana',kind:'Continental',label:'Um novo capítulo continental',shape:'spire'},
  {id:'world',name:'Mundial de Clubes',kind:'Mundial',label:'O topo do futebol mundial',shape:'globe'},
];
export const emptyClub = () => ({ contracts: [], awards: [] });
export function sanitizeState(raw, clubIds) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const id of clubIds) {
    const value = raw[id]; if (!value || typeof value !== 'object') continue;
    const occupied = new Set();
    const contracts = (Array.isArray(value.contracts) ? value.contracts : []).filter(offerId => {
      const offer = offers.find(o => o.id === offerId);
      if (!offer || occupied.has(offer.slot)) return false;
      occupied.add(offer.slot); return true;
    });
    const awards = [...new Set(Array.isArray(value.awards) ? value.awards : [])].filter(id=>trophies.some(t=>t.id===id));
    result[id] = { contracts, awards };
  }
  return result;
}
export function signContract(state, offerId) {
  const offer = offers.find(o=>o.id===offerId);
  if (!offer || state.contracts.some(id=>offers.find(o=>o.id===id)?.slot===offer.slot)) return state;
  return {...state, contracts:[...state.contracts,offerId]};
}
export function contractTotals(state) {
  const active = offers.filter(o=>state.contracts.includes(o.id));
  return {monthly:active.reduce((s,o)=>s+o.monthly,0), committed:active.reduce((s,o)=>s+o.monthly*o.months+o.bonus,0), bonus:active.reduce((s,o)=>s+o.bonus,0)};
}
