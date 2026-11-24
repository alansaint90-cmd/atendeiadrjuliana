"use server";
import { executar } from "../acao";
import { exigirSessao } from "../auth/sessao";
import { exigirPermissao } from "../auth/permissoes";
import { db } from "../db/client";
import { consultarOperacao } from "../operacao/consultas";
import { effectiveSettings } from "../settings/repository";
import { agentRedis } from "../agent/redis";
import { pausaManualAtiva } from "../agent/pausa";
import { digest } from "../agent/message";
import { configurarAgente } from "../agent/config";
import { settingsDaInstancia } from "../evolution/instancias";
import { chatbotDaInstancia } from "../chatbots/server-repository";
import { leitorStatusAtendimento } from "../atendimento/status";

export async function carregarOperacao() {
  return executar(async () => {
    const sessao = await exigirSessao(); await exigirPermissao(sessao, "operador");
    let client:ReturnType<typeof agentRedis>|undefined;
    try {
      const settings=await effectiveSettings();
      if(settings.REDIS_URL){client=agentRedis(settings.REDIS_URL);await client.connect();}
      const configuracoes=new Map<string,Promise<boolean>>();
      const lerStatus=leitorStatusAtendimento({
        pausaManual:async(instancia,jid)=>{if(!client)throw new Error('Status indisponível');return pausaManualAtiva(client,digest(`${instancia}:${jid}`));},
        iaDisponivel:instancia=>{
          if(!configuracoes.has(instancia))configuracoes.set(instancia,(async()=>configurarAgente(settingsDaInstancia(settings,instancia),await chatbotDaInstancia(db(),instancia)).success)());
          return configuracoes.get(instancia)!;
        },
      });
      return await consultarOperacao(db(),lerStatus);
    }catch{return consultarOperacao(db());}
    finally{client?.disconnect();}
  });
}
