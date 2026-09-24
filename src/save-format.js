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
