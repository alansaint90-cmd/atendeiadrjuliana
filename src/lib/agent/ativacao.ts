import type Redis from "ioredis";
import { digest, type IncomingMessage } from "./message";
import { agentKeys, owned, assertResult } from "./redis";

export const duracaoAtivacao = 86400;
export const chaveAtivacao = (conversa: string) => "atendeia:{evolution}:activation:" + conversa;
const normalizar = (texto: string) => texto.normalize("NFC").trim();
export const revisaoGatilho = (gatilho: string) => digest(normalizar(gatilho));

export function correspondeAoGatilho(mensagem: IncomingMessage, gatilho: string) {
  return !mensagem.audio && !mensagem.midia && normalizar(mensagem.text) === normalizar(gatilho);
}

export async function ativacaoValida(client: Pick<Redis, "get">, conversa: string, gatilho?: string) {
  return !gatilho || await client.get(chaveAtivacao(conversa)) === revisaoGatilho(gatilho);
}

export async function autorizarAtivacao(client: Pick<Redis, "eval">, token: string, mensagem: IncomingMessage, gatilho: string) {
  // O lease, a comparação da revisão e a renovação da sessão são atômicos.
  const resultado = await client.eval(owned + "if redis.call('GET', KEYS[2]) ~= ARGV[2] and ARGV[3] ~= '1' then return 2 end; " +
    "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[4]); return 1", 2, agentKeys.lock, chaveAtivacao(mensagem.conversation), token,
  revisaoGatilho(gatilho), correspondeAoGatilho(mensagem, gatilho) ? "1" : "0", duracaoAtivacao);
  if (resultado === 2) return false;
  await assertResult(resultado);
  return true;
}
