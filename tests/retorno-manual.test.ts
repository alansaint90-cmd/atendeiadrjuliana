import test from "node:test";
import assert from "node:assert/strict";
import type Redis from "ioredis";
import { encerraPausaManual, pausasManuaisParaEvento, pausaManualKey, estadoManualKey } from "../src/lib/agent/pausa";
import { enqueueEvolutionEventWithClient } from "../src/lib/evolution/queue";
import { digest } from "../src/lib/agent/message";
import type { EvolutionEvent } from "../src/lib/evolution/schema";
const evento = (texto: string, fromMe = true): EvolutionEvent => ({ event: "messages.upsert", instance: "drjuli", data: {
 key: { id: "mensagem", fromMe, remoteJid: "5511999999999@s.whatsapp.net" }, messageTimestamp: Math.floor(Date.now()/1000), message: { conversation: texto } } });
test("gancho exige a frase inteira e aceita acentos e pontuação", () => {
 for (const texto of ["Se precisar de algo mais, é só chamar", "SE PRECISAR DE ALGO MAIS E SO CHAMAR?", " Se precisar de algo mais é só chamar! "]) assert.equal(encerraPausaManual(texto), true);
 for (const texto of ["Se precisar de algo mais", "Não: se precisar de algo mais é só chamar", "Se precisar de algo mais é só chamar amanhã", "Ficamos à disposição."]) assert.equal(encerraPausaManual(texto), false);
});
test("somente texto de saída manual gera retomada e isola a instância", async () => {
 const client = { get: async () => null, set: async () => "OK" } as unknown as Redis;
 assert.deepEqual(await pausasManuaisParaEvento(client, evento("Se precisar de algo mais é só chamar", false)), []);
 const [retorno] = await pausasManuaisParaEvento(client, evento("Se precisar de algo mais é só chamar"));
 assert.equal(retorno.retomar, true);
 assert.equal(retorno.conversation, digest("drjuli:5511999999999@s.whatsapp.net"));
 const [outro] = await pausasManuaisParaEvento(client, { ...evento("Se precisar de algo mais é só chamar"), instance: "outro" });
 assert.notEqual(retorno.conversation, outro.conversation);
 const [normal] = await pausasManuaisParaEvento(client, evento("Vou conferir"));
 assert.equal(normal.retomar, false);
 const longo = evento(""); (longo.data as Record<string, unknown>).message = { extendedTextMessage: { text: "Se precisar de algo mais, é só chamar." } };
 assert.equal((await pausasManuaisParaEvento(client, longo))[0].retomar, true);
});
test("retomada usa a mesma transação da fila e chaves de pausa e controle por conversa", async () => {
 let chamada: unknown[] = [];
 const client = {get: async()=>null,set:async()=>"OK",eval:async(...args:unknown[])=>{chamada=args;return 1}} as unknown as Redis;
 assert.equal(await enqueueEvolutionEventWithClient(client, evento("Se precisar de algo mais, é só chamar")), "queued");
 const conversa = digest("drjuli:5511999999999@s.whatsapp.net");
 assert.ok(chamada.includes(pausaManualKey(conversa)));
 assert.ok(chamada.includes(estadoManualKey(conversa)));
 assert.equal(chamada[1],7);
 const acao=JSON.parse(String(chamada[chamada.length-2]));
 assert.equal(acao[0].retomar,true);
 assert.equal(acao[0].conversation,conversa);
});

test("Redis real: gancho libera pausa, ignora eco e recusa eventos antigos", { skip: !process.env.TEST_REDIS_URL }, async () => {
 const url = new URL(process.env.TEST_REDIS_URL!);
 assert.ok(["localhost","127.0.0.1"].includes(url.hostname) && url.pathname === "/15");
 const { default: RedisClient } = await import("ioredis");
 const { randomUUID } = await import("node:crypto");
 const real = new RedisClient(url.toString());
 const instancia = "retorno-"+randomUUID(), stream = "atendeia:{evolution}:teste-retorno:"+randomUUID();
 const limpar = new Set<string>([stream]);
 const client = { get: (key:string)=>real.get(key), set: (...args:unknown[]) => Reflect.apply(real.set,real,args),
  eval: async(script:string,n:number,...args:(string|number)[])=>{
   args[0]=stream;
   args.slice(0,n).forEach(key=>{if(key!=="atendeia:{evolution}:followups")limpar.add(String(key));});
   return real.eval(script,n,...args);
  } } as unknown as Redis;
 const base=Math.floor(Date.now()/1000)-10;
 const criar=(texto:string,segundo:number,fromMe=true)=>{
  const e=evento(texto,fromMe);e.instance=instancia;(e.data as Record<string,unknown>).key={id:randomUUID(),fromMe,remoteJid:"5511999999999@s.whatsapp.net"};
  (e.data as Record<string,unknown>).messageTimestamp=base+segundo;return e;
 };
 const conversa=digest(instancia+":5511999999999@s.whatsapp.net"), chave=pausaManualKey(conversa);
 try {
  await enqueueEvolutionEventWithClient(client,criar("Atendimento humano",1));
  assert.ok(await real.get(chave));
  const eco=criar("Se precisar de algo mais, é só chamar",2);
  const id=(eco.data as {key:{id:string}}).key.id;
  const saida="atendeia:{evolution}:outgoing:"+digest(instancia+":"+id);limpar.add(saida);
  await real.set(saida,"1","EX",60);
  await enqueueEvolutionEventWithClient(client,eco);
  assert.ok(await real.get(chave),"eco da IA não libera a pausa");
  await enqueueEvolutionEventWithClient(client,criar("Se precisar de algo mais, é só chamar",3));
  assert.equal(await real.get(chave),null);
  await enqueueEvolutionEventWithClient(client,criar("Evento antigo",1));
  assert.equal(await real.get(chave),null,"evento antigo não recria pausa encerrada");
  await enqueueEvolutionEventWithClient(client,criar("Nova intervenção",5));
  assert.ok(await real.get(chave));
  await enqueueEvolutionEventWithClient(client,criar("Se precisar de algo mais, é só chamar",4));
  assert.ok(await real.get(chave),"gancho antigo não encerra intervenção nova");
  await enqueueEvolutionEventWithClient(client,criar("Se precisar de algo mais, é só chamar",6,false));
  assert.ok(await real.get(chave),"cliente não pode retomar a IA");
 } finally { await real.del(...limpar);real.disconnect(); }
});
