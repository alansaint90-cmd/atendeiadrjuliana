import {administradorHttp} from '@/lib/auth/acesso-http';
import {db} from '@/lib/db/client';
import {effectiveSettings} from '@/lib/settings/repository';
import {audioDaConversa,respostaAudio} from '@/lib/atendimento/audio-conversa';
import {z} from 'zod';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const erro=(status:number)=>Response.json({erro:'Não foi possível carregar este áudio.'},{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 const acesso=await administradorHttp('operador');if(acesso.erro)return erro(acesso.erro);
 const {id}=await params;if(!z.uuid().safeParse(id).success)return erro(400);
 try {
  const audio=await audioDaConversa(db(),acesso.sessao!,id,await effectiveSettings());
  return audio?respostaAudio(audio,request.headers.get('range')):erro(404);
 }catch{return erro(502);}
}
