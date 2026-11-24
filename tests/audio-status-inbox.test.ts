import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {applyMigrations} from '../src/lib/db/migrate';
import {systemUserId} from '../src/lib/db/bootstrap';
import {receberOperacao} from '../src/lib/operacao/receber';
import {consultarOperacao} from '../src/lib/operacao/consultas';
import {audioDaConversa,respostaAudio} from '../src/lib/atendimento/audio-conversa';
import {leitorStatusAtendimento} from '../src/lib/atendimento/status';
import {carregarAudioEvolution} from '../src/lib/agent/audio';

test('modo usa tomada humana e pausa manual real; incerteza não aparece como IA',async()=>{
 let manual=false,disponivel=true;
 const ler=leitorStatusAtendimento({pausaManual:async()=>manual,iaDisponivel:async()=>disponivel});
 const c={status:'open',humano:false,instancia:'teste',jid:'5571000000001@s.whatsapp.net'};
 assert.equal(await ler(c),'ia');manual=true;assert.equal(await ler(c),'humano');manual=false;disponivel=false;assert.equal(await ler(c),'pausada');
 const falhou=leitorStatusAtendimento({pausaManual:async()=>{throw new Error('Redis indisponível');},iaDisponivel:async()=>true});
 assert.equal(await falhou(c),'indisponivel');assert.equal(await falhou({...c,humano:true}),'humano');assert.equal(await falhou({...c,status:'closed'}),'encerrado');
});

test('mídia rejeita base64 inválido e resposta acima de dez megabytes antes de reproduzir',async()=>{
 const config={EVOLUTION_API_URL:'https://example.invalid',EVOLUTION_API_KEY:'teste',EVOLUTION_INSTANCE_NAME:'teste'};
 await assert.rejects(carregarAudioEvolution(config,'id',async()=>Response.json({mimetype:'audio/ogg',base64:'@@@@'})),/audio_base64_invalido/);
 await assert.rejects(carregarAudioEvolution(config,'id',async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(14*1024*1024));c.close();}}))),/audio_limite_excedido/);
});

test('áudio já registrado é recuperado só pelo ID/chip do banco, com limites, exclusão lógica e auditoria',async()=>{
 const cliente=new PGlite(),banco=drizzle(cliente),ator={userId:systemUserId,papel:'operador' as const};
 const settings={EVOLUTION_API_URL:'https://example.invalid',EVOLUTION_API_KEY:'chave-ficticia',EVOLUTION_INSTANCE_NAME:'teste',OPENAI_API_KEY:'sk-fake',REDIS_URL:'redis://localhost:6379'};
 let chamadas=0;const bytes=Buffer.from('OggS-audio-de-teste');
 const request:typeof fetch=async(url,init)=>{chamadas++;assert.equal(String(url),'https://example.invalid/chat/getBase64FromMediaMessage/teste');assert.deepEqual(JSON.parse(String(init?.body)),{message:{key:{id:'audio-antigo'}},convertToMp4:false});return Response.json({mimetype:'audio/ogg; codecs=opus',base64:bytes.toString('base64')});};
 try {
  await applyMigrations(banco);
  await receberOperacao(banco,{event:'messages.upsert',instance:'teste',data:{key:{id:'audio-antigo',fromMe:false,remoteJid:'5571000000001@s.whatsapp.net'},messageTimestamp:Math.floor(Date.now()/1000),message:{audioMessage:{url:'https://nao-acessar.example/privado.enc'}}}});
  const resumo=await consultarOperacao(banco,leitorStatusAtendimento({pausaManual:async()=>false,iaDisponivel:async()=>true}));
  const conversa=resumo.conversas[0],m=conversa.mensagens[0];assert.equal(m.tipo,'audio');assert.equal(conversa.modoAtendimento,'ia');
  const audio=await audioDaConversa(banco,ator,m.id,settings,request);assert.ok(audio);assert.deepEqual(audio.bytes,bytes);
  const r=respostaAudio(audio,null);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'audio/ogg');assert.match(r.headers.get('Cache-Control')!,/private.*no-store/);assert.equal(r.headers.get('X-Content-Type-Options'),'nosniff');
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array(bytes));
  const parcial=respostaAudio(audio,'bytes=0-3');assert.equal(parcial.status,206);assert.equal(await parcial.text(),'OggS');
  assert.equal(respostaAudio(audio,'bytes=9999-').status,416);assert.equal(respostaAudio(audio,'bytes=0-1,5-6').status,416);
  await assert.rejects(audioDaConversa(banco,ator,m.id,{...settings,EVOLUTION_INSTANCE_NAME:'outro'},request),/canal/);assert.equal(chamadas,1);
  await assert.rejects(audioDaConversa(banco,ator,m.id,settings,async()=>Response.json({mimetype:'text/html',base64:bytes.toString('base64')})),/audio_formato_invalido/);
  assert.equal(await audioDaConversa(banco,ator,randomUUID(),settings,request),null);assert.equal(chamadas,1);
  await cliente.query('UPDATE atendeia_conversations SET human_takeover=true WHERE id=$1',[conversa.id]);assert.equal((await consultarOperacao(banco)).conversas[0].modoAtendimento,'humano');
  await cliente.query('UPDATE atendeia_messages SET is_deleted=true WHERE id=$1',[m.id]);assert.equal(await audioDaConversa(banco,ator,m.id,settings,request),null);assert.equal(chamadas,1);
  assert.equal((await cliente.query("SELECT id FROM atendeia_audit_logs WHERE action='audio_conversa_acessado'")).rows.length,1);
 }finally{await cliente.close();}
});
