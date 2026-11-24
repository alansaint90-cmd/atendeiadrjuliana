export type ModoAtendimento='ia'|'humano'|'pausada'|'indisponivel'|'encerrado';
export interface DadosStatusAtendimento { status:string; humano:boolean; instancia:string; jid:string }

/** Modo responsável pela conversa, não um indicador de saúde do worker. */
export function leitorStatusAtendimento(deps:{pausaManual:(instancia:string,jid:string)=>Promise<boolean>;iaDisponivel:(instancia:string)=>Promise<boolean>}) {
 return async(c:DadosStatusAtendimento):Promise<ModoAtendimento>=>{
  if(c.status==='closed')return 'encerrado';
  if(c.humano)return 'humano';
  try {
   if(await deps.pausaManual(c.instancia,c.jid))return 'humano';
   return await deps.iaDisponivel(c.instancia)?'ia':'pausada';
  }catch{return 'indisponivel';}
 };
}
