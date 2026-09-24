// Historical honours database used by the release build.
// Scope: official senior men's first-team trophies commonly recognized by clubs,
// federations and confederations. Counts reflect public records available in 2026.
// Career trophies earned in the save are added on top of these historical counts.

const h=(id,name,kind,count,years=[],shape='cup')=>({id,name,kind,count,years,shape});

export const CLUB_HONOURS={
  '3458':[
    h('sulamericana','CONMEBOL Sul-Americana','Continental',2,[2018,2021],'globe'),
    h('suruga','Copa Suruga Bank','Continental',1,[2019],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',1,[2001],'league'),
    h('copa','Copa do Brasil','Nacional',1,[2019],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[1995],'league'),
    h('paranaense','Campeonato Paranaense','Estadual',28,[],'cup'),
  ],
  '7632':[
    h('libertadores','CONMEBOL Libertadores','Continental',1,[2013],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2014],'globe'),
    h('conmebol','Copa CONMEBOL','Continental',2,[1992,1997],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',3,[1937,1971,2021],'league'),
    h('copa','Copa do Brasil','Nacional',2,[2014,2021],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',1,[2022],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2006],'league'),
    h('mineiro','Campeonato Mineiro','Estadual',50,[],'cup'),
    h('taca-minas','Taça Minas Gerais','Estadual',5,[1975,1976,1979,1986,1987],'cup'),
  ],
  '9967':[
    h('brasileirao','Campeonato Brasileiro','Nacional',2,[1959,1988],'league'),
    h('nordeste','Copa do Nordeste','Regional',5,[2001,2002,2017,2021,2025],'cup'),
    h('norte-nordeste','Torneio Norte-Nordeste','Regional',4,[1948,1959,1961,1963],'cup'),
    h('baiano','Campeonato Baiano','Estadual',52,[],'cup'),
    h('taca-estado-bahia','Taça Estado da Bahia','Estadual',3,[2000,2002,2007],'cup'),
    h('bahia-pernambuco','Taça Bahia-Pernambuco','Regional',2,[1993,1994],'cup'),
  ],
  '6086':[
    h('libertadores','CONMEBOL Libertadores','Continental',1,[2024],'globe'),
    h('conmebol','Copa CONMEBOL','Continental',1,[1993],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',3,[1968,1995,2024],'league'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',2,[2015,2021],'league'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',4,[1962,1964,1966,1998],'cup'),
    h('carioca','Campeonato Carioca','Estadual',21,[],'cup'),
    h('guanabara','Taça Guanabara','Estadual',8,[1967,1968,1997,2006,2009,2010,2013,2015],'cup'),
    h('taca-rio','Taça Rio','Estadual',10,[1989,1997,2007,2008,2010,2012,2013,2023,2024,2026],'cup'),
  ],
  '9318':[
    h('sulamericana','CONMEBOL Sul-Americana','Continental',1,[2016],'globe'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2020],'league'),
    h('catarinense','Campeonato Catarinense','Estadual',7,[1977,1996,2007,2011,2016,2017,2020],'cup'),
    h('copa-sc','Copa Santa Catarina','Estadual',1,[2006],'cup'),
  ],
  '874':[
    h('world','Mundial de Clubes FIFA','Mundial',2,[2000,2012],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',1,[2012],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2013],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',7,[1990,1998,1999,2005,2011,2015,2017],'league'),
    h('copa','Copa do Brasil','Nacional',4,[1995,2002,2009,2025],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',2,[1991,2026],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2008],'league'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',5,[1950,1953,1954,1966,2002],'cup'),
    h('paulista','Campeonato Paulista','Estadual',31,[],'cup'),
  ],
  '3456':[
    h('brasileirao','Campeonato Brasileiro','Nacional',1,[1985],'league'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',3,[2007,2010,2025],'league'),
    h('paranaense','Campeonato Paranaense','Estadual',39,[],'cup'),
  ],
  '2022':[
    h('libertadores','CONMEBOL Libertadores','Continental',2,[1976,1997],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[1998],'globe'),
    h('supercopa-lib','Supercopa Libertadores','Continental',2,[1991,1992],'globe'),
    h('copa-ouro','Copa Ouro','Continental',1,[1995],'globe'),
    h('master-supercopa','Copa Master da Supercopa','Continental',1,[1995],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',4,[1966,2003,2013,2014],'league'),
    h('copa','Copa do Brasil','Nacional',6,[1993,1996,2000,2003,2017,2018],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2022],'league'),
    h('sul-minas','Copa Sul-Minas','Regional',2,[2001,2002],'cup'),
    h('mineiro','Campeonato Mineiro','Estadual',39,[],'cup'),
  ],
  '819':[
    h('world','Copa Intercontinental','Mundial',1,[1981],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',4,[1981,2019,2022,2025],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2020],'globe'),
    h('mercosul','Copa Mercosul','Continental',1,[1999],'globe'),
    h('copa-ouro','Copa Ouro','Continental',1,[1996],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',9,[1980,1982,1983,1987,1992,2009,2019,2020,2025],'league'),
    h('copa','Copa do Brasil','Nacional',5,[1990,2006,2013,2022,2024],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',3,[2020,2021,2025],'cup'),
    h('copa-campeoes','Copa dos Campeões','Nacional',1,[2001],'cup'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',1,[1961],'cup'),
    h('carioca','Campeonato Carioca','Estadual',40,[],'cup'),
  ],
  '3445':[
    h('copa-rio','Copa Rio Internacional','Mundial',1,[1952],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',1,[2023],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2024],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',4,[1970,1984,2010,2012],'league'),
    h('copa','Copa do Brasil','Nacional',1,[2007],'cup'),
    h('serie-c','Campeonato Brasileiro Série C','Nacional',1,[1999],'league'),
    h('primeira-liga','Primeira Liga','Regional',1,[2016],'cup'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',3,[1940,1957,1960],'cup'),
    h('carioca','Campeonato Carioca','Estadual',33,[],'cup'),
  ],
  '6273':[
    h('world','Copa Intercontinental','Mundial',1,[1983],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',3,[1983,1995,2017],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',2,[1996,2018],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',2,[1981,1996],'league'),
    h('copa','Copa do Brasil','Nacional',5,[1989,1994,1997,2001,2016],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',1,[1990],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2005],'league'),
    h('gaucho','Campeonato Gaúcho','Estadual',44,[],'cup'),
    h('recopa-gaucha','Recopa Gaúcha','Estadual',5,[2019,2021,2022,2023,2025],'cup'),
  ],
  '1936':[
    h('world','Mundial de Clubes FIFA','Mundial',1,[2006],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',2,[2006,2010],'globe'),
    h('sulamericana','CONMEBOL Sul-Americana','Continental',1,[2008],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',2,[2007,2011],'globe'),
    h('suruga','Copa Suruga Bank','Continental',1,[2009],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',3,[1975,1976,1979],'league'),
    h('copa','Copa do Brasil','Nacional',1,[1992],'cup'),
    h('gaucho','Campeonato Gaúcho','Estadual',46,[],'cup'),
    h('recopa-gaucha','Recopa Gaúcha','Estadual',3,[2016,2017,2026],'cup'),
  ],
  '9169':[
    h('serie-c','Campeonato Brasileiro Série C','Nacional',1,[2022],'league'),
    h('serie-d','Campeonato Brasileiro Série D','Nacional',1,[2020],'league'),
    h('paulista-a3','Campeonato Paulista Série A3','Estadual',1,[1997],'cup'),
  ],
  '2029':[
    h('copa-rio','Copa Rio Internacional','Mundial',1,[1951],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',3,[1999,2020,2021],'globe'),
    h('mercosul','Copa Mercosul','Continental',1,[1998],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2022],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',12,[1960,1967,1967,1969,1972,1973,1993,1994,2016,2018,2022,2023],'league'),
    h('copa','Copa do Brasil','Nacional',4,[1998,2012,2015,2020],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',1,[2023],'cup'),
    h('copa-campeoes','Copa dos Campeões','Nacional',1,[2000],'cup'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',5,[1933,1951,1965,1993,2000],'cup'),
    h('paulista','Campeonato Paulista','Estadual',27,[],'cup'),
  ],
  '6079':[
    h('serie-b','Campeonato Brasileiro Série B','Nacional',2,[1989,2019],'league'),
    h('serie-c','Campeonato Brasileiro Série C','Nacional',1,[2007],'league'),
    h('paulista','Campeonato Paulista','Estadual',1,[1990],'cup'),
    h('trofeu-interior','Troféu do Interior Paulista','Estadual',1,[2020],'cup'),
    h('paulista-a2','Campeonato Paulista Série A2','Estadual',2,[1965,1988],'cup'),
    h('paulista-segunda','Campeonato Paulista Segunda Divisão','Estadual',1,[1979],'cup'),
  ],
  '4936':[
    h('serie-c','Campeonato Brasileiro Série C','Nacional',1,[2005],'league'),
    h('copa-verde','Copa Verde','Regional',1,[2021],'cup'),
    h('paraense','Campeonato Paraense','Estadual',48,[],'cup'),
  ],
  '2674':[
    h('world','Copa Intercontinental','Mundial',2,[1962,1963],'globe'),
    h('recopa-intercontinental','Recopa Intercontinental','Mundial',1,[1968],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',3,[1962,1963,2011],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',1,[2012],'globe'),
    h('conmebol','Copa CONMEBOL','Continental',1,[1998],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',8,[1961,1962,1963,1964,1965,1968,2002,2004],'league'),
    h('copa','Copa do Brasil','Nacional',1,[2010],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2024],'league'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',5,[1959,1963,1964,1966,1997],'cup'),
    h('paulista','Campeonato Paulista','Estadual',22,[],'cup'),
  ],
  '2026':[
    h('world','Mundial de Clubes / Intercontinental','Mundial',3,[1992,1993,2005],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',3,[1992,1993,2005],'globe'),
    h('sulamericana','CONMEBOL Sul-Americana','Continental',1,[2012],'globe'),
    h('recopa','Recopa Sul-Americana','Continental',2,[1993,1994],'globe'),
    h('supercopa-lib','Supercopa Libertadores','Continental',1,[1993],'globe'),
    h('conmebol','Copa CONMEBOL','Continental',1,[1994],'globe'),
    h('master-conmebol','Copa Master da CONMEBOL','Continental',1,[1996],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',6,[1977,1986,1991,2006,2007,2008],'league'),
    h('copa','Copa do Brasil','Nacional',1,[2023],'cup'),
    h('supercopa','Supercopa do Brasil','Nacional',1,[2024],'cup'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',1,[2001],'cup'),
    h('paulista','Campeonato Paulista','Estadual',22,[],'cup'),
    h('superpaulista','Supercampeonato Paulista','Estadual',1,[2002],'cup'),
  ],
  '3454':[
    h('sulamericano-1948','Campeonato Sul-Americano de Campeões','Continental',1,[1948],'globe'),
    h('libertadores','CONMEBOL Libertadores','Continental',1,[1998],'globe'),
    h('mercosul','Copa Mercosul','Continental',1,[2000],'globe'),
    h('rivadavia','Torneio Rivadávia Corrêa Meyer','Internacional',1,[1953],'globe'),
    h('brasileirao','Campeonato Brasileiro','Nacional',4,[1974,1989,1997,2000],'league'),
    h('copa','Copa do Brasil','Nacional',1,[2011],'cup'),
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2009],'league'),
    h('rio-sp','Torneio Rio-São Paulo','Regional',3,[1958,1966,1999],'cup'),
    h('carioca','Campeonato Carioca','Estadual',24,[],'cup'),
  ],
  '3457':[
    h('serie-b','Campeonato Brasileiro Série B','Nacional',1,[2023],'league'),
    h('nordeste','Copa do Nordeste','Regional',5,[1997,1999,2003,2010,2026],'cup'),
    h('baiano','Campeonato Baiano','Estadual',30,[],'cup'),
  ],
};

export const HONOUR_FILTERS=['Todos','Mundial','Internacional','Continental','Nacional','Regional','Estadual'];

export function historicalHonours(clubId){
  return (CLUB_HONOURS[String(clubId)]||[]).map(item=>({...item,years:[...(item.years||[])]}));
}

export function honoursWithCareer(clubId,career){
  const base=historicalHonours(clubId);
  const careerWins=career?.trophies||[];
  const byId=new Map(base.map(item=>[item.id,{...item,historicalCount:item.count,careerCount:0,careerYears:[]}]));
  for(const won of careerWins){
    const existing=byId.get(won.id);
    if(existing){
      existing.careerCount++;
      existing.careerYears.push(won.season);
      existing.count=existing.historicalCount+existing.careerCount;
    }else{
      const fallback={id:won.id,name:won.name||'Título conquistado',kind:won.kind||'Nacional',shape:won.shape||'cup',historicalCount:0,careerCount:1,careerYears:[won.season],years:[],count:1};
      byId.set(won.id,fallback);
    }
  }
  return [...byId.values()].sort((a,b)=>{
    const rank={Mundial:0,Internacional:1,Continental:2,Nacional:3,Regional:4,Estadual:5};
    return (rank[a.kind]??9)-(rank[b.kind]??9)||b.count-a.count||a.name.localeCompare(b.name,'pt-BR');
  });
}

export function historicalTitleTotal(clubId){
  return historicalHonours(clubId).reduce((sum,item)=>sum+item.count,0);
}
