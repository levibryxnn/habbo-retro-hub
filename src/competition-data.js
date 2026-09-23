const external=(id,name,abbr,country,power,wiki)=>({id,name,abbreviation:abbr||name.slice(0,3).toUpperCase(),country,power,wikiQuery:wiki||name+' football club',external:true});

export const SERIE_A_STATE={
  '3458':'PR','3456':'PR',
  '7632':'MG','2022':'MG',
  '9967':'BA','3457':'BA',
  '6086':'RJ','819':'RJ','3445':'RJ','3454':'RJ',
  '9318':'SC',
  '874':'SP','9169':'SP','2029':'SP','6079':'SP','2674':'SP','2026':'SP',
  '6273':'RS','1936':'RS',
  '4936':'PA',
};

const S={
  sp:{id:'paulista',name:'Paulistão',region:'SP',format:'swiss8',start:'01-10',end:'03-08',teams:[
    '874','2029','2026','2674','6079','9169',
    external('sp:sao-bernardo','São Bernardo','SBE','BRA',69,'São Bernardo Futebol Clube'),
    external('sp:novorizontino','Novorizontino','NOV','BRA',70,'Grêmio Novorizontino'),
    external('sp:guarani','Guarani','GUA','BRA',66,'Guarani FC'),
    external('sp:ponte-preta','Ponte Preta','PON','BRA',66,'Associação Atlética Ponte Preta'),
    external('sp:velo','Velo Clube','VEL','BRA',61,'Velo Clube'),
    external('sp:portuguesa','Portuguesa','POR','BRA',64,'Associação Portuguesa de Desportos'),
    external('sp:primavera','Primavera','PRI','BRA',60,'Esporte Clube Primavera'),
    external('sp:capivariano','Capivariano','CAP','BRA',59,'Capivariano Futebol Clube'),
    external('sp:noroeste','Noroeste','NOR','BRA',61,'Esporte Clube Noroeste'),
    external('sp:botafogo','Botafogo-SP','BOT','BRA',64,'Botafogo Futebol Clube Ribeirão Preto'),
  ],leagueRounds:8,qualify:8,knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:1},{name:'Final',legs:2}]},
  rj:{id:'carioca',name:'Campeonato Carioca',region:'RJ',format:'cross6',start:'01-14',end:'03-15',groups:[
    ['3445','3454',external('rj:bangu','Bangu','BAN','BRA',61),external('rj:portuguesa','Portuguesa-RJ','POR','BRA',61),external('rj:sampaio','Sampaio Corrêa-RJ','SAM','BRA',59),external('rj:volta-redonda','Volta Redonda','VOL','BRA',67)],
    ['6086','819',external('rj:boavista','Boavista-RJ','BOA','BRA',60),external('rj:madureira','Madureira','MAD','BRA',60),external('rj:marica','Maricá','MAR','BRA',59),external('rj:nova-iguacu','Nova Iguaçu','NIG','BRA',62)]
  ],qualifyPerGroup:4,knockoutPairing:'within-group',knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:2},{name:'Final',legs:1}]},
  mg:{id:'mineiro',name:'Campeonato Mineiro',region:'MG',format:'cross3',start:'01-10',end:'03-07',groups:[
    ['7632',external('mg:democrata','Democrata-GV','DEM','BRA',60),external('mg:uberlandia','Uberlândia','UBE','BRA',61),external('mg:urt','URT','URT','BRA',58)],
    [external('mg:america','América-MG','AME','BRA',70),external('mg:betim','Betim','BET','BRA',60),external('mg:pouso','Pouso Alegre','POU','BRA',60),external('mg:tombense','Tombense','TOM','BRA',64)],
    ['2022',external('mg:athletic','Athletic Club','ATH','BRA',68),external('mg:itabirito','Itabirito','ITA','BRA',59),external('mg:north','North','NOR','BRA',58)]
  ],qualifyMode:'group-winners-best-runner',knockout:[{name:'Semifinal',legs:2},{name:'Final',legs:1}]},
  ba:{id:'baiano',name:'Campeonato Baiano',region:'BA',format:'round-robin',start:'01-11',end:'03-08',teams:[
    '9967','3457',
    external('ba:atletico','Atlético de Alagoinhas','ALA','BRA',59),
    external('ba:jacuipense','Jacuipense','JAC','BRA',62),
    external('ba:porto','Porto-BA','POR','BRA',58),
    external('ba:juazeirense','Juazeirense','JUA','BRA',62),
    external('ba:jequie','Jequié','JEQ','BRA',58),
    external('ba:barcelona','Barcelona de Ilhéus','BAR','BRA',59),
    external('ba:bahia-feira','Bahia de Feira','BFE','BRA',60),
    external('ba:galicia','Galícia','GAL','BRA',57),
  ],leagueRounds:9,qualify:4,knockout:[{name:'Semifinal',legs:1},{name:'Final',legs:1}]},
  pr:{id:'paranaense',name:'Campeonato Paranaense',region:'PR',format:'cross6',start:'01-07',end:'03-07',groups:[
    ['3458',external('pr:cascavel','Cascavel','CAS','BRA',62),external('pr:foz','Foz do Iguaçu','FOZ','BRA',58),external('pr:londrina','Londrina','LON','BRA',65),external('pr:maringa','Maringá','MAR','BRA',66),external('pr:sao-joseense','São Joseense','SJO','BRA',58)],
    ['3456',external('pr:andraus','Andraus','AND','BRA',57),external('pr:azuriz','Azuriz','AZU','BRA',61),external('pr:cianorte','Cianorte','CIA','BRA',62),external('pr:galo','Galo Maringá','GAL','BRA',57),external('pr:operario','Operário-PR','OPE','BRA',67)]
  ],qualifyPerGroup:4,knockoutPairing:'within-group',knockout:[{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:2}]},
  rs:{id:'gaucho',name:'Gauchão',region:'RS',format:'cross6',start:'01-10',end:'03-08',groups:[
    ['6273',external('rs:caxias','Caxias','CAX','BRA',66,'Sociedade Esportiva e Recreativa Caxias do Sul'),external('rs:guarany','Guarany de Bagé','GUA','BRA',58),external('rs:monsoon','Monsoon','MON','BRA',59,'Monsoon Futebol Clube'),external('rs:sao-jose','São José-RS','SJO','BRA',63,'Esporte Clube São José'),external('rs:sao-luiz','São Luiz','SLU','BRA',61,'Esporte Clube São Luiz')],
    ['1936',external('rs:avenida','Avenida','AVE','BRA',58,'Esporte Clube Avenida'),external('rs:inter-sm','Inter-SM','ISM','BRA',59),external('rs:juventude','Juventude','JUV','BRA',69,'Esporte Clube Juventude'),external('rs:novo-hamburgo','Novo Hamburgo','NHA','BRA',60,'Esporte Clube Novo Hamburgo'),external('rs:ypiranga','Ypiranga-RS','YPI','BRA',65,'Ypiranga Futebol Clube (Erechim)')]
  ],qualifyPerGroup:4,knockoutPairing:'within-group',knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:2},{name:'Final',legs:2}]},
  sc:{id:'catarinense',name:'Campeonato Catarinense',region:'SC',format:'cross6',start:'01-07',end:'03-08',groups:[
    [external('sc:avai','Avaí','AVA','BRA',68),external('sc:camboriu','Camboriú','CAM','BRA',59),external('sc:concordia','Concórdia','CON','BRA',61),external('sc:marcilio','Marcílio Dias','MDS','BRA',61),external('sc:joinville','Joinville','JOI','BRA',64),external('sc:brusque','Brusque','BRU','BRA',66)],
    ['9318',external('sc:carlos-renaux','Carlos Renaux','CRE','BRA',58),external('sc:barra','Barra FC','BAR','BRA',62),external('sc:figueirense','Figueirense','FIG','BRA',65),external('sc:criciuma','Criciúma','CRI','BRA',69),external('sc:santa-catarina','Santa Catarina','SCA','BRA',61)]
  ],qualifyPerGroup:4,knockoutPairing:'within-group',knockout:[{name:'Quartas de final',legs:2},{name:'Semifinal',legs:2},{name:'Final',legs:2}]},
  pa:{id:'paraense',name:'Campeonato Paraense',region:'PA',format:'cross6',start:'01-24',end:'03-08',groups:[
    ['4936',external('pa:cameta','Cametá','CAM','BRA',59),external('pa:capitao-poco','Capitão Poço','CPO','BRA',56),external('pa:santa-rosa','Santa Rosa','SRO','BRA',57),external('pa:sao-raimundo','São Raimundo-PA','SRA','BRA',59),external('pa:tuna','Tuna Luso','TUN','BRA',62)],
    [external('pa:paysandu','Paysandu','PAY','BRA',68),external('pa:amazonia','Amazônia Independente','AMA','BRA',56),external('pa:aguia','Águia de Marabá','AGU','BRA',62),external('pa:bragantino','Bragantino-PA','BPA','BRA',58),external('pa:castanhal','Castanhal','CAS','BRA',59),external('pa:sao-francisco','São Francisco-PA','SFR','BRA',58)]
  ],qualifyOverall:8,knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:1},{name:'Final',legs:2}]},
};
export const STATE_CONFIGS=S;

export const LIBERTADORES_GROUPS_2026={
 A:['819',external('lib:estudiantes','Estudiantes','EST','ARG',84,'Estudiantes de La Plata'),external('lib:cusco','Cusco FC','CUS','PER',72,'Cusco FC'),external('lib:dim','Independiente Medellín','DIM','COL',78,'Independiente Medellín')],
 B:[external('lib:nacional','Nacional','NAC','URU',82,'Club Nacional de Football'),external('lib:universitario','Universitario','UNI','PER',77,'Club Universitario de Deportes'),external('lib:coquimbo','Coquimbo Unido','COQ','CHI',72),external('lib:tolima','Deportes Tolima','TOL','COL',78)],
 C:['3445',external('lib:bolivar','Bolívar','BOL','BOL',79,'Club Bolívar'),external('lib:la-guaira','Deportivo La Guaira','DLG','VEN',70),external('lib:rivadavia','Independiente Rivadavia','IRV','ARG',76)],
 D:[external('lib:boca','Boca Juniors','BOC','ARG',87,'Boca Juniors'), '2022', external('lib:ucatolica','Universidad Católica','UCA','CHI',78,'Club Deportivo Universidad Católica'),external('lib:barcelona','Barcelona SC','BSC','ECU',78,'Barcelona S.C.')],
 E:[external('lib:penarol','Peñarol','PEN','URU',84,'Peñarol'), '874', external('lib:santa-fe','Santa Fe','SFE','COL',78,'Independiente Santa Fe'),external('lib:platense','Platense','PLA','ARG',75,'Club Atlético Platense')],
 F:['2029',external('lib:cerro','Cerro Porteño','CER','PAR',81,'Cerro Porteño'),external('lib:junior','Junior','JUN','COL',79,'Atlético Junior'),external('lib:sporting-cristal','Sporting Cristal','SCR','PER',78,'Sporting Cristal')],
 G:[external('lib:ldu','LDU Quito','LDU','ECU',83,'L.D.U. Quito'),external('lib:lanus','Lanús','LAN','ARG',81,'Club Atlético Lanús'),external('lib:always-ready','Always Ready','ALW','BOL',74,'Club Always Ready'),'9169'],
 H:[external('lib:idv','Independiente del Valle','IDV','ECU',84,'Independiente del Valle'),external('lib:libertad','Libertad','LIB','PAR',81,'Club Libertad'),external('lib:rosario','Rosario Central','ROS','ARG',81,'Rosario Central'),external('lib:ucv','Universidad Central','UCV','VEN',70,'Universidad Central de Venezuela F.C.')],
};

export const SUDAMERICANA_GROUPS_2026={
 A:[external('sud:america-cali','América de Cali','AME','COL',79),external('sud:tigre','Tigre','TIG','ARG',76),external('sud:macara','Macará','MAC','ECU',71),external('sud:alianza-atletico','Alianza Atlético','AAT','PER',70)],
 B:['7632',external('sud:cienciano','Cienciano','CIE','PER',75),external('sud:puerto-cabello','Academia Puerto Cabello','APC','VEN',69),external('sud:juventud','Juventud','JUV','URU',70)],
 C:['2026',external('sud:millonarios','Millonarios','MIL','COL',80),external('sud:boston-river','Boston River','BOR','URU',72),external('sud:ohiggins',"O'Higgins",'OHI','CHI',73)],
 D:['2674',external('sud:san-lorenzo','San Lorenzo','SLO','ARG',80),external('sud:deportivo-cuenca','Deportivo Cuenca','DCU','ECU',71),external('sud:recoleta','Recoleta','REC','PAR',69)],
 E:[external('sud:racing','Racing Club','RAC','ARG',85,'Racing Club de Avellaneda'),external('sud:caracas','Caracas','CAR','VEN',72),external('sud:independiente-petrolero','Independiente Petrolero','INP','BOL',70),'6086'],
 F:['6273',external('sud:palestino','Palestino','PAL','CHI',75),external('sud:torque','Montevideo City Torque','MCT','URU',73),external('sud:riestra','Deportivo Riestra','RIE','ARG',73)],
 G:[external('sud:olimpia','Olimpia','OLI','PAR',82,'Club Olimpia'),'3454',external('sud:audax','Audax Italiano','AUD','CHI',73),external('sud:barracas','Barracas Central','BAR','ARG',73)],
 H:[external('sud:river','River Plate','RIV','ARG',88,'Club Atlético River Plate'),'6079',external('sud:blooming','Blooming','BLO','BOL',70),external('sud:carabobo','Carabobo','CAR','VEN',69)],
};

export const UCL_POTS_2026=[
 [
  external('ucl:psg','Paris Saint-Germain','PSG','FRA',97,'Paris Saint-Germain F.C.'),external('ucl:bayern','Bayern München','BAY','GER',96,'FC Bayern Munich'),external('ucl:real','Real Madrid','RMA','ESP',97),external('ucl:liverpool','Liverpool','LIV','ENG',95),external('ucl:inter','Inter','INT','ITA',94,'Inter Milan'),external('ucl:city','Manchester City','MCI','ENG',96),external('ucl:arsenal','Arsenal','ARS','ENG',95),external('ucl:barcelona','Barcelona','BAR','ESP',96,'FC Barcelona'),external('ucl:atleti','Atlético de Madrid','ATM','ESP',93)
 ],
 [
  external('ucl:dortmund','Borussia Dortmund','BVB','GER',91),external('ucl:roma','Roma','ROM','ITA',89,'AS Roma'),external('ucl:sporting','Sporting CP','SCP','POR',90),external('ucl:villa','Aston Villa','AVL','ENG',90),external('ucl:porto','Porto','POR','POR',90,'FC Porto'),external('ucl:united','Manchester United','MUN','ENG',90),external('ucl:brugge','Club Brugge','BRU','BEL',86),external('ucl:betis','Real Betis','BET','ESP',88),external('ucl:psv','PSV','PSV','NED',89,'PSV Eindhoven')
 ],
 [
  external('ucl:feyenoord','Feyenoord','FEY','NED',87),external('ucl:lille','Lille','LIL','FRA',87,'Lille OSC'),external('ucl:bodo','Bodø/Glimt','BOD','NOR',84),external('ucl:napoli','Napoli','NAP','ITA',90),external('ucl:leipzig','Leipzig','RBL','GER',88,'RB Leipzig'),external('ucl:villarreal','Villarreal','VIL','ESP',88),external('ucl:fener','Fenerbahçe','FEN','TUR',87),external('ucl:shakhtar','Shakhtar Donetsk','SHA','UKR',86),external('ucl:galatasaray','Galatasaray','GAL','TUR',88)
 ],
 [
  external('ucl:slavia','Slavia Praha','SLA','CZE',83,'SK Slavia Prague'),external('ucl:slovan','Slovan Bratislava','SLO','SVK',80),external('ucl:stuttgart','Stuttgart','STU','GER',87,'VfB Stuttgart'),external('ucl:aek','AEK Athens','AEK','GRE',82,'AEK Athens F.C.'),external('ucl:lask','LASK','LAS','AUT',81,'LASK'),external('ucl:como','Como','COM','ITA',84,'Como 1907'),external('ucl:lens','Lens','LEN','FRA',85,'RC Lens'),external('ucl:viking','Viking','VIK','NOR',81,'Viking FK'),external('ucl:sabah','Sabah','SAB','AZE',77,'Sabah FC Azerbaijan')
 ]
];

export const UCL_2025_26_CHAMPION='ucl:psg';

export const REGIONAL_GROUPS_2026={
  nordeste:{
    id:'copa-nordeste',name:'Copa do Nordeste',userClubs:['3457'],format:'groups-one-leg',start:'03-25',end:'06-07',
    groups:{
      A:['3457',external('ne:asa','ASA','ASA','BRA',62),external('ne:sousa','Sousa','SOU','BRA',61),external('ne:itabaiana','Itabaiana','ITA','BRA',61),external('ne:fluminense-pi','Fluminense-PI','FPI','BRA',59)],
      B:[external('ba:juazeirense','Juazeirense','JUA','BRA',62),external('cdb:crb','CRB','CRB','BRA',67),external('ne:botafogo-pb','Botafogo-PB','BPB','BRA',64),external('ne:confianca','Confiança','CON','BRA',64),external('ne:piaui','Piauí','PIA','BRA',58)],
      C:[external('cdb:ceara','Ceará','CEA','BRA',70),external('cdb:sport','Sport','SPO','BRA',69),external('ne:america-rn','América-RN','ARN','BRA',63),external('ne:imperatriz','Imperatriz','IMP','BRA',58),external('ne:ferroviario','Ferroviário','FER','BRA',62)],
      D:[external('cdb:fortaleza','Fortaleza','FOR','BRA',73),external('ne:retro','Retrô','RET','BRA',64),external('ne:abc','ABC','ABC','BRA',64),external('ne:maranhao','Maranhão','MAR','BRA',60),external('ba:jacuipense','Jacuipense','JAC','BRA',62)]
    },qualifyPerGroup:2,knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:1},{name:'Final',legs:2}]
  },
  verde:{
    id:'copa-verde',name:'Copa Verde',userClubs:['4936'],format:'groups-one-leg',start:'03-24',end:'06-07',
    groups:{
      A:[external('cv:gas','Grêmio Sampaio','GAS','BRA',56),external('cv:guapore','Guaporé','GUA','BRA',56),external('cv:independencia','Independência-AC','IND','BRA',57),external('cv:nacional','Nacional-AM','NAC','BRA',62),external('pa:paysandu','Paysandu','PAY','BRA',68),external('cv:trem','Trem','TRE','BRA',58)],
      B:[external('pa:aguia','Águia de Marabá','AGU','BRA',62),external('cv:amazonas','Amazonas','AMA','BRA',67),external('cv:galvez','Galvez','GAL','BRA',56),external('cv:monte-roraima','Monte Roraima','MRO','BRA',55),external('cv:porto-velho','Porto Velho','PVE','BRA',59),'4936'],
      C:[external('cv:araguaina','Araguaína','ARA','BRA',58),external('cv:capital','Capital-DF','CAP','BRA',59),external('cv:operario-ms','Operário-MS','OMS','BRA',59),external('cv:primavera-mt','Primavera-MT','PRI','BRA',58),external('cv:rio-branco','Rio Branco-ES','RBE','BRA',60),external('cv:vila-nova','Vila Nova','VNO','BRA',68)],
      D:[external('cv:anapolis','Anápolis','ANA','BRA',61),external('cv:atletico-go','Atlético-GO','ACG','BRA',69),external('cv:cuiaba','Cuiabá','CUI','BRA',68),external('cv:gama','Gama','GAM','BRA',61),external('cv:porto-vitoria','Porto Vitória','PVI','BRA',59),external('cv:tocantinopolis','Tocantinópolis','TOC','BRA',60)]
    },qualifyPerGroup:2,knockout:[{name:'Quartas de final',legs:1},{name:'Semifinal',legs:2},{name:'Final',legs:2}]
  },
  sulSudeste:{
    id:'copa-sul-sudeste',name:'Copa Sul-Sudeste',userClubs:['9318'],format:'cross6',start:'03-24',end:'06-07',
    groups:{
      A:[external('rs:caxias','Caxias','CAX','BRA',66,'Sociedade Esportiva e Recreativa Caxias do Sul'),'9318',external('pr:cianorte','Cianorte','CIA','BRA',62),external('sp:novorizontino','Novorizontino','NOV','BRA',70),external('rj:sampaio','Sampaio Corrêa-RJ','SAM','BRA',59),external('mg:tombense','Tombense','TOM','BRA',64)],
      B:[external('mg:america','América-MG','AME','BRA',70),external('sc:avai','Avaí','AVA','BRA',68),external('rs:juventude','Juventude','JUV','BRA',69,'Esporte Clube Juventude'),external('pr:operario','Operário-PR','OPE','BRA',67),external('sp:sao-bernardo','São Bernardo','SBE','BRA',69),external('rj:volta-redonda','Volta Redonda','VOL','BRA',67)]
    },qualifyPerGroup:2,knockout:[{name:'Semifinal',legs:2},{name:'Final',legs:2}]
  }
};

export const COPA_DO_BRASIL_QUALIFIERS=[
 external('cdb:ceara','Ceará','CEA','BRA',70),external('cdb:fortaleza','Fortaleza','FOR','BRA',73),external('cdb:sport','Sport','SPO','BRA',69),external('mg:america','América-MG','AME','BRA',70),
 external('rs:juventude','Juventude','JUV','BRA',69,'Esporte Clube Juventude'),external('sc:criciuma','Criciúma','CRI','BRA',69),external('sc:avai','Avaí','AVA','BRA',68),external('pr:operario','Operário-PR','OPE','BRA',67),
 external('sp:novorizontino','Novorizontino','NOV','BRA',70),external('pa:paysandu','Paysandu','PAY','BRA',68),external('cdb:crb','CRB','CRB','BRA',67),external('cdb:goias','Goiás','GOI','BRA',69)
];

export function flattenWorldClubs(){
  const map=new Map();
  const add=item=>{if(item&&typeof item==='object'&&item.id)map.set(String(item.id),item);};
  for(const state of Object.values(S))for(const item of [...(state.teams||[]),...(state.groups||[]).flat()])add(item);
  for(const groups of [LIBERTADORES_GROUPS_2026,SUDAMERICANA_GROUPS_2026])for(const list of Object.values(groups))for(const item of list)add(item);
  for(const pot of UCL_POTS_2026)for(const item of pot)add(item);
  for(const config of Object.values(REGIONAL_GROUPS_2026))for(const item of Object.values(config.groups).flat())add(item);
  for(const item of COPA_DO_BRASIL_QUALIFIERS)add(item);
  return Array.from(map.values());
}
export const WORLD_CLUBS=flattenWorldClubs();
export function worldClubById(id){return WORLD_CLUBS.find(club=>String(club.id)===String(id))||null;}
export function stateConfigForClub(clubId){
  const state=SERIE_A_STATE[String(clubId)];
  return state?Object.values(S).find(item=>item.region===state)||null:null;
}
