export const SAVE_SIGNATURE='linha-de-frente-save';
export const SAVE_FILE_VERSION=1;

export function buildSavePayload(career,club){
  if(!career||!career.userClubId)throw new Error('Carreira inválida.');
  return{
    signature:SAVE_SIGNATURE,
    fileVersion:SAVE_FILE_VERSION,
    exportedAt:new Date().toISOString(),
    club:{id:String(club?.id||career.userClubId),name:String(club?.name||'Clube')},
    career,
  };
}
export function serializeCareerSave(career,club){
  return JSON.stringify(buildSavePayload(career,club));
}
export function parseCareerSave(text){
  let payload;
  try{payload=JSON.parse(String(text||''));}catch{throw new Error('Arquivo de save inválido.');}
  if(!payload||payload.signature!==SAVE_SIGNATURE||!payload.career||!payload.career.userClubId)throw new Error('Este arquivo não é um save válido do Linha de Frente.');
  if(Number(payload.fileVersion||0)>SAVE_FILE_VERSION)throw new Error('Este save foi criado por uma versão mais nova do jogo.');
  return payload;
}
export function saveFileName(career,club){
  const safe=String(club?.name||'clube').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
  return 'linha-de-frente-'+safe+'-'+String(career?.season||'save')+'.ldf';
}

export const MANUAL_SAVE_SLOT_COUNT=2;
const manualSlotKey=slot=>'ldf.manualSave.v1.'+Number(slot);
function saveStorage(storage){
  const target=storage??globalThis?.localStorage;
  if(!target)throw new Error('Armazenamento local indisponível neste navegador.');
  return target;
}
export function listManualSaveSlots(storage){
  const target=saveStorage(storage),slots=[];
  for(let slot=1;slot<=MANUAL_SAVE_SLOT_COUNT;slot++){
    const raw=target.getItem(manualSlotKey(slot));if(!raw){slots.push({slot,empty:true});continue;}
    try{
      const payload=parseCareerSave(raw);
      slots.push({slot,empty:false,savedAt:payload.exportedAt||null,club:payload.club,season:payload.career?.season||null,managerName:payload.career?.managerName||'',payload});
    }catch{slots.push({slot,empty:true,corrupt:true});}
  }
  return slots;
}
export function writeManualSaveSlot(slot,career,club,storage){
  if(slot<1||slot>MANUAL_SAVE_SLOT_COUNT)throw new Error('Slot de save inválido.');
  const target=saveStorage(storage),payload=buildSavePayload(career,club),raw=JSON.stringify(payload);
  try{target.setItem(manualSlotKey(slot),raw);}catch{throw new Error('Não há espaço suficiente para este save local. Exporte um arquivo .ldf para manter um backup seguro.');}
  return{slot,empty:false,savedAt:payload.exportedAt,club:payload.club,season:payload.career?.season||null,managerName:payload.career?.managerName||'',payload};
}
export function deleteManualSaveSlot(slot,storage){
  if(slot<1||slot>MANUAL_SAVE_SLOT_COUNT)return;
  saveStorage(storage).removeItem(manualSlotKey(slot));
}
