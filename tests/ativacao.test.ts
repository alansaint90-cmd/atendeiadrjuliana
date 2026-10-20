import test from "node:test";
import assert from "node:assert/strict";
import { correspondeAoGatilho, autorizarAtivacao, ativacaoValida, chaveAtivacao, revisaoGatilho, duracaoAtivacao } from "../src/lib/agent/ativacao";
import { processMessage, type DeliveryState, type ProcessingPort } from "../src/lib/agent/processor";
import { incomingMessage, type IncomingMessage } from "../src/lib/agent/message";
import { agentKeys } from "../src/lib/agent/redis";
import type { AgentConfig } from "../src/lib/agent/config";
import { settingsSchema } from "../src/lib/settings/schema";

const gatilho = "Mensagem exclusiva do anúncio de teste";
const configuracao: AgentConfig = { AI_ENABLED: "true", AI_ACTIVATION_TRIGGER: gatilho, AI_SYSTEM_PROMPT: "Atenda com precisão.",
  OPENAI_API_KEY: "sk-test-only", OPENAI_MODEL: "modelo-teste", EVOLUTION_API_URL: "https://example.invalid",
  EVOLUTION_API_KEY: "teste", EVOLUTION_INSTANCE_NAME: "chip-a", REDIS_URL: "redis://localhost:6379/15" };
const mensagem: IncomingMessage = { identity: "mensagem-teste", conversation: "conversa-teste", number: "5511999999999", text: "Oi", timestamp: 1700000000 };

test("gatilho exige a mensagem completa, sem aproximação por intenção ou trecho", () => {
  assert.equal(correspondeAoGatilho({ ...mensagem, text: gatilho }, gatilho), true);
  assert.equal(correspondeAoGatilho({ ...mensagem, text: ` ${gatilho}\n` }, gatilho), true);
  for (const texto of ["Oi", "Quero agendar", gatilho + "!", gatilho.toLowerCase(), "Encaminhada: " + gatilho]) {
    assert.equal(correspondeAoGatilho({ ...mensagem, text: texto }, gatilho), false);
  }
  assert.equal(correspondeAoGatilho({ ...mensagem, text: gatilho, audio: { id: "audio" } }, gatilho), false);
  assert.equal(correspondeAoGatilho({ ...mensagem, text: gatilho, midia: true }, gatilho), false);
});

function cenario() {
  let estado: DeliveryState | null = null;
  let ativo = false;
  let agora = 0;
  let expira = 0;
  let atual = mensagem;
  const chamadas = { geracao: 0, envio: 0, transcricao: 0, agenda: 0, abertura: 0 };
  const porta: ProcessingPort = {
    read: async () => estado, write: async valor => { estado = valor; }, history: async () => [], enabled: async () => true,
    autorizarAtivacao: async texto => {
      if (agora >= expira) ativo = false;
      if (!ativo && !correspondeAoGatilho(atual, texto)) return false;
      ativo = true; expira = agora + duracaoAtivacao; return true;
    },
    complete: async valor => { estado = valor; },
    generate: async () => { chamadas.geracao++; return "Como posso ajudar?"; },
    send: async () => { chamadas.envio++; return "resposta-teste"; },
    transcribe: async () => { chamadas.transcricao++; return gatilho; },
    cadastroConsulta: async () => { chamadas.agenda++; return "Escolha o horário."; },
  };
  return { porta, chamadas, enviar: async (texto: string, extras: Partial<IncomingMessage> = {}, config = configuracao) => {
    estado = null; atual = { ...mensagem, identity: String(agora++), text: texto, ...extras };
    return processMessage(atual, config, porta);
  }, avancar: (segundos: number) => { agora += segundos; } };
}

test("sem gatilho não chama modelo, áudio, agenda nem abertura literal", async () => {
  const c = cenario();
  assert.equal(await c.enviar("Oi", {}, { ...configuracao, openingMessages: ["Olá!"], agendaConsultas: true }), "aguardando_gatilho");
  assert.equal(await c.enviar("", { audio: { id: "audio-teste" } }), "aguardando_gatilho");
  assert.deepEqual(c.chamadas, { geracao: 0, envio: 0, transcricao: 0, agenda: 0, abertura: 0 });
});

test("gatilho libera as próximas mensagens e expira após 24 horas sem atividade", async () => {
  const c = cenario();
  assert.equal(await c.enviar(gatilho), "enviada");
  assert.equal(await c.enviar("Qual o endereço?"), "enviada");
  c.avancar(duracaoAtivacao + 1);
  assert.equal(await c.enviar("Oi"), "aguardando_gatilho");
  assert.equal(c.chamadas.envio, 2);
  assert.equal(await c.enviar(gatilho), "enviada");
});

test("pausa humana prevalece e ausência do controle fecha o atendimento", async () => {
  const c = cenario(); c.porta.enabled = async () => false;
  assert.equal(await c.enviar(gatilho), "pausada");
  c.porta.enabled = async () => true; c.porta.autorizarAtivacao = undefined;
  assert.equal(await c.enviar(gatilho), "aguardando_gatilho");
  assert.equal(c.chamadas.envio, 0);
});

test("sem configuração de gatilho preserva o atendimento habitual", async () => {
  const c = cenario();
  assert.equal(await c.enviar("Oi", {}, { ...configuracao, AI_ACTIVATION_TRIGGER: undefined }), "enviada");
});

test("Redis exige lease e usa revisão e TTL sem guardar texto do cliente", async () => {
  let argumentos: unknown[] = [];
  const cliente = { eval: async (...valores: unknown[]) => { argumentos = valores; return 1; } } as unknown as Parameters<typeof autorizarAtivacao>[0];
  assert.equal(await autorizarAtivacao(cliente, "lease", { ...mensagem, text: gatilho }, gatilho), true);
  assert.deepEqual(argumentos.slice(1), [2, agentKeys.lock, chaveAtivacao(mensagem.conversation), "lease", revisaoGatilho(gatilho), "1", duracaoAtivacao]);
  assert.equal(JSON.stringify(argumentos).includes(gatilho), false);
  const recusado = { eval: async () => 2 } as unknown as Parameters<typeof autorizarAtivacao>[0];
  assert.equal(await autorizarAtivacao(recusado, "lease", mensagem, gatilho), false);
  const leasePerdido = { eval: async () => 0 } as unknown as Parameters<typeof autorizarAtivacao>[0];
  await assert.rejects(autorizarAtivacao(leasePerdido, "lease", mensagem, gatilho), /Posse/);
});

test("nome ou histórico prévio não substitui ativação; chip e cliente não compartilham sessão", async () => {
  const c = cenario();
  c.porta.contactName = async () => "Cliente";
  c.porta.history = async () => [{ role: "assistant", content: "Conversa anterior" }];
  assert.equal(await c.enviar("Oi"), "aguardando_gatilho");
  const criar = (instancia: string, telefone: string) => incomingMessage({ event: "messages.upsert", instance: instancia,
    data: { key: { id: "entrada", fromMe: false, remoteJid: telefone + "@s.whatsapp.net" }, messageTimestamp: 1700000000, message: { conversation: gatilho } } }, instancia, 1700000000000)!;
  const principal = criar("chip-a", "5511999999999");
  assert.notEqual(chaveAtivacao(principal.conversation), chaveAtivacao(criar("chip-b", "5511999999999").conversation));
  assert.notEqual(chaveAtivacao(principal.conversation), chaveAtivacao(criar("chip-a", "5511888888888").conversation));
});

test("follow-up exige revisão ativa e mudança de gatilho invalida autorização anterior", async () => {
  const cliente = { get: async () => revisaoGatilho(gatilho) } as Parameters<typeof ativacaoValida>[0];
  assert.equal(await ativacaoValida(cliente, mensagem.conversation, gatilho), true);
  assert.equal(await ativacaoValida(cliente, mensagem.conversation, "Outro gatilho"), false);
  assert.equal(await ativacaoValida({ get: async () => null } as Parameters<typeof ativacaoValida>[0], mensagem.conversation, gatilho), false);
  assert.equal(await ativacaoValida(cliente, mensagem.conversation), true);
  assert.equal(settingsSchema.safeParse({ AI_ACTIVATION_TRIGGER: "\n" }).success, false);
  assert.equal(settingsSchema.safeParse({ AI_ACTIVATION_TRIGGER: gatilho }).success, true);
});
