"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { executar, ErroDeNegocio } from "../acao";
import { exigirSessao } from "../auth/sessao";
import { exigirPermissao } from "../auth/permissoes";
import { effectiveSettings } from "../settings/repository";
import { db } from "../db/client";
import { agentRedis } from "../agent/redis";
import { digest } from "../agent/message";
import { listarFilaSql, modificarFilaSql } from "../agendamentos/fila-repository";
import { listarFilaFollowups, modificarFilaFollowup } from "../agendamentos/fila-followups";
import { operacaoFila, type MensagemFila } from "../agendamentos/fila-schema";
export async function carregarFilaMensagens(){
 return executar(async()=>{
  const sessao=await exigirSessao();await exigirPermissao(sessao,"admin");
  const config=await effectiveSettings();const itens=await listarFilaSql(db());const avisos:string[]=[];
  if(config.REDIS_URL){const client=agentRedis(config.REDIS_URL);try{await client.connect();itens.push(...await listarFilaFollowups(client,config));}catch{avisos.push("Não foi possível consultar os follow-ups no Redis. A lista está parcial; atualize antes de alterar todos os envios.");}finally{client.disconnect();}}
  else avisos.push("Redis não configurado: os follow-ups não puderam ser consultados.");
  return {itens:itens.sort((a,b)=>a.data.localeCompare(b.data)||a.id.localeCompare(b.id)),avisos,ativo:process.env.ATENDEIA_WORKER_ENABLED==="true"};
 });
}
export async function alterarFilaMensagens(entrada:unknown){
 return executar(async()=>{
  const sessao=await exigirSessao();await exigirPermissao(sessao,"admin");const dados=operacaoFila.parse(entrada);
  const config=await effectiveSettings();let client:ReturnType<typeof agentRedis>|undefined;let followups:MensagemFila[]=[];
  if(dados.alvos.some(a=>a.origem==="followup")){
   if(!config.REDIS_URL)throw new ErroDeNegocio("Redis indisponível. Nenhum envio foi alterado.");
   client=agentRedis(config.REDIS_URL);try{await client.connect();followups=await listarFilaFollowups(client,config);}catch{client.disconnect();throw new ErroDeNegocio("Não foi possível validar os follow-ups. Nenhum envio foi alterado.");}
  }
  let alterados=0;const falhas:string[]=[];
  try{for(const alvo of dados.alvos){try{
   if(alvo.origem!=="followup")await modificarFilaSql(db(),alvo,dados.acao,sessao.userId);
   else{
    const item=followups.find(i=>i.id===alvo.id&&i.versao===alvo.versao);if(!item||!client)throw new ErroDeNegocio("Follow-up alterado. Atualize a lista.");
    const hash=digest(alvo.id);const auditId=hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32);
    await db().execute(sql`INSERT INTO atendeia_audit_logs(action,entity_type,entity_id,changed_fields,modified_by) VALUES(${"fila_followup_"+dados.acao+"_solicitado"},'followup',${auditId},'["fila"]'::jsonb,${sessao.userId})`);
    await modificarFilaFollowup(client,alvo,dados.acao,item);
   }alterados++;
  }catch(error){falhas.push(error instanceof ErroDeNegocio?error.message:"Um registro não pôde ser alterado. Atualize a lista.");}}}
  finally{client?.disconnect();}
  revalidatePath("/");return {alterados,naoAlterados:falhas.length,avisos:[...new Set(falhas)]};
 });
}
