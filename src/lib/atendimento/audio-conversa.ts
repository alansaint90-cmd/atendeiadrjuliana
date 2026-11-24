import {sql} from 'drizzle-orm';
import {z} from 'zod';
import {linhas,type BancoSql} from '../db/porta';
import {exigirPermissao,type SessaoAtiva} from '../auth/permissoes';
import {settingsDaInstancia} from '../evolution/instancias';
import {settingsSchema,type IntegrationSettings} from '../settings/schema';
import {carregarAudioEvolution} from '../agent/audio';
import {ErroDeNegocio} from '../acao';

const configAudio=settingsSchema.pick({EVOLUTION_API_URL:true,EVOLUTION_API_KEY:true,EVOLUTION_INSTANCE_NAME:true}).required();
export async function audioDaConversa(banco:BancoSql,ator:SessaoAtiva,id:string,settings:IntegrationSettings,request=fetch) {
 await exigirPermissao(ator,'operador',banco);z.uuid().parse(id);
 const consulta=sql`SELECT m.provider_message_id provedor,ch.instance_name instancia FROM atendeia_messages m
  JOIN atendeia_conversations c ON c.id=m.conversation_id JOIN atendeia_channels ch ON ch.id=c.channel_id JOIN atendeia_contacts p ON p.id=c.contact_id
  WHERE m.id=${id} AND m.message_type='audio' AND m.is_deleted=false AND c.is_deleted=false AND ch.is_deleted=false AND p.is_deleted=false AND ch.provider='evolution'`;
 const [m]=linhas<{provedor:string|null;instancia:string}>(await banco.execute(consulta));
 if(!m?.provedor)return null;
 const canal=settingsDaInstancia(settings,m.instancia);
 const config=configAudio.safeParse(canal && {EVOLUTION_API_URL:canal.EVOLUTION_API_URL,EVOLUTION_API_KEY:canal.EVOLUTION_API_KEY,EVOLUTION_INSTANCE_NAME:canal.EVOLUTION_INSTANCE_NAME});
 if(!config.success)throw new ErroDeNegocio('O canal deste áudio não está disponível.');
 const audio=await carregarAudioEvolution(config.data,m.provedor,request);
 const [atual]=linhas<{provedor:string|null;instancia:string}>(await banco.execute(consulta));
 if(!atual || atual.provedor!==m.provedor || atual.instancia!==m.instancia)return null;
 await banco.execute(sql`INSERT INTO atendeia_audit_logs(action,entity_type,entity_id,changed_fields,modified_by) VALUES('audio_conversa_acessado','mensagem',${id},'[]'::jsonb,${ator.userId})`);
 return audio;
}

/** Range único para o player nativo; bytes nunca vêm de URL recebida no webhook. */
export function respostaAudio(audio:{bytes:Uint8Array;mime:string;extensao:string},range:string|null) {
 const tamanho=audio.bytes.length,headers=new Headers({'Content-Type':audio.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Disposition':`inline; filename="audio.${audio.extensao}"`,'Accept-Ranges':'bytes'});
 let inicio=0,fim=tamanho-1,status=200;
 if(range){
  const m=range.match(/^bytes=(\d*)-(\d*)$/);
  if(!m || !m[1]&&!m[2]){headers.set('Content-Range',`bytes */${tamanho}`);return new Response(null,{status:416,headers});}
  inicio=m[1]?Number(m[1]):Math.max(0,tamanho-Number(m[2]));fim=m[1]&&m[2]?Math.min(Number(m[2]),tamanho-1):tamanho-1;
  if(!Number.isSafeInteger(inicio)||!Number.isSafeInteger(fim)||inicio<0||inicio>=tamanho||fim<inicio||(!m[1]&&Number(m[2])===0)){headers.set('Content-Range',`bytes */${tamanho}`);return new Response(null,{status:416,headers});}
  status=206;headers.set('Content-Range',`bytes ${inicio}-${fim}/${tamanho}`);
 }
 const parte=audio.bytes.subarray(inicio,fim+1);headers.set('Content-Length',String(parte.length));
 return new Response(new Uint8Array(parte),{status,headers});
}
