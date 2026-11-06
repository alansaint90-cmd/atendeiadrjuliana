import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { randomUUID } from "node:crypto";
import { applyMigrations } from "../src/lib/db/migrate";
import { systemUserId } from "../src/lib/db/bootstrap";
import { pacienteSchema } from "../src/lib/consultas/schema";
import { camposPendentes, perguntaDados, normalizarCampo } from "../src/lib/consultas/coleta";
import { consultarHorarios, reservarConsulta, listarConsultas } from "../src/lib/consultas/repository";
import { proximasQuintas } from "../src/lib/consultas/calendario";
const paciente = {nomeCompleto:"Paciente Exemplo",idade:"36",telefone:"",cep:"",rua:"Rua Teste",numero:"10",complemento:"",bairro:"Centro",cidade:"Salvador",uf:"" as const};
test("cadastro pede somente idade e aceita cinco anos sem data de nascimento",()=>{
 assert.equal(perguntaDados({nomeCompleto:"Paciente Exemplo"}),"Qual é a sua idade?");
 assert.equal(normalizarCampo("idade","tenho trinta e seis anos"),"36");
 assert.deepEqual(camposPendentes({...paciente}),[]);
 assert.equal(pacienteSchema.safeParse({...paciente,idade:"5"}).success,true);
 for(const idade of ["4","0","-1","36.5","121","",undefined]) assert.equal(pacienteSchema.safeParse({...paciente,idade}).success,false);
 assert.equal(pacienteSchema.parse(paciente).nascimento,undefined,"não inventar data de nascimento");
});
test("reserva persiste idade sem nascimento e preserva consultas antigas após migração",async()=>{
 const cliente=new PGlite();const banco=drizzle(cliente);
 try{
  await applyMigrations(banco);
  const dia=proximasQuintas(Date.now()+7*86400000)[0];const vagas=await consultarHorarios(banco,dia);
  const contexto=()=>({instancia:"teste",origem:"auditoria-idade",identidade:randomUUID(),autor:systemUserId});
  const antiga={...paciente,idade:undefined,nascimento:"1990-02-20"};
  const legado=await reservarConsulta(banco,{horarioId:vagas[0].id,paciente:antiga,dadosConferidos:true},contexto());
  const nova=await reservarConsulta(banco,{horarioId:vagas[1].id,paciente,dadosConferidos:true},contexto());
  assert.equal(nova.idade,"36");assert.equal(nova.nascimento,null);
  await assert.rejects(cliente.query("UPDATE atendeia_agenda_horarios_reservas SET idade=4 WHERE id=$1",[nova.id]));
  await applyMigrations(banco);
  const reservas=await listarConsultas(banco,dia);
  assert.equal(reservas.find(r=>r.id===legado.id)?.nascimento,"1990-02-20");
  assert.equal(reservas.find(r=>r.id===nova.id)?.idade,"36");
  await assert.rejects(reservarConsulta(banco,{horarioId:vagas[2].id,paciente:{...paciente,idade:"4"},dadosConferidos:true},contexto()));
 }finally{await cliente.close();}
});
