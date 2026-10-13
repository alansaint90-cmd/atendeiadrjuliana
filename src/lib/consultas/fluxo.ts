import { randomUUID } from "node:crypto";
import { ErroDeNegocio } from "../acao";
import { pacienteSchema, formatarConsulta, type PacienteConsulta, type HorarioConsulta, type Consulta } from "./schema";
import { horaInformada } from "./intencao";
import { camposPendentes, perguntaDados, perguntaIdentificacao, perguntaLocal, normalizarCampo, type CampoPaciente } from "./coleta";

const campos = ["nomeCompleto", "telefone", "nascimento", "cep", "rua", "numero", "complemento", "bairro", "cidade", "uf"] as const;
const contatoCamacari = "Em Camaçari, a Dra. Juliana atende no Hospital SEMERGE. Para agendar, fale diretamente pelo WhatsApp: (71) 3621-4575.\nhttps://api.whatsapp.com/send?phone=557136214575\nO hospital confirma os horários e as condições da consulta.";
export interface CadastroConsulta { id: string; etapa: "horario" | "dados" | "local" | "conferencia" | "encerrado"; opcoes: HorarioConsulta[]; local?: "salvador";
  horario?: HorarioConsulta; paciente: Partial<PacienteConsulta>; ultimaMensagem?: string; ultimaResposta?: string }
export interface PortaCadastroConsulta {
  ler(): Promise<CadastroConsulta | null>; salvar(dados: CadastroConsulta): Promise<void>;
  vagas(dia?: string, depoisDe?: string): Promise<HorarioConsulta[]>; reservar(dados: { horarioId: string; paciente: PacienteConsulta; dadosConferidos: true }, identidade: string): Promise<Consulta>;
  ativo(): Promise<boolean>;
  extrair?(texto: string, campos: CampoPaciente[]): Promise<Partial<Record<CampoPaciente, string>>>;
}
function menu(opcoes: HorarioConsulta[]) {
  return opcoes.length ? `A Dra. Juliana atende na Clínica Bonvida somente às quintas-feiras, com inícios entre 8h e 11h20. Consultei a agenda e estes são os próximos horários livres (horário de Brasília): 👇\n\n${opcoes.map((v, i) => `${i + 1}. ${formatarConsulta(v.inicio)}`).join("\n")}\n\nQual desses horários você prefere? Responda com o número da opção ou com o horário. A vaga é reservada após o cadastro completo e a conferência dos dados.`
    : "Não encontrei vagas disponíveis. A equipe precisa verificar a agenda; nenhuma consulta foi marcada.";
}
export function mensagensDaConsulta(resposta: string): string[] {
  const partes = resposta.split("\n\n");
  const menuDeVagas = partes[0].endsWith("👇") && /^1\. /u.test(partes[1] ?? "")
    && partes[2]?.startsWith("Qual desses horários você prefere?");
  const conferencia = partes[0] === "Confira os dados antes de agendar."
    && partes[1]?.startsWith("Nome: ") && partes[2]?.startsWith("Os dados e o horário estão corretos?");
  return partes.length === 3 && (menuDeVagas || conferencia) ? partes : [resposta];
}
function resumo(d: CadastroConsulta) {
  const p = pacienteSchema.parse(d.paciente);
  return `Confira os dados antes de agendar.\n\nNome: ${p.nomeCompleto}${p.telefone ? `\nTelefone: ${p.telefone}` : ""}\nData de nascimento: ${p.nascimento.split("-").reverse().join("/")}\nEndereço: ${p.rua}, ${p.numero}${p.complemento ? `, referência/complemento: ${p.complemento}` : ""}, ${p.bairro}, ${p.cidade}/${p.uf}${p.cep ? `, CEP ${p.cep}` : ""}\nData da consulta em Salvador: ${formatarConsulta(d.horario!.inicio)} (horário de Brasília).\n\nOs dados e o horário estão corretos? Confirma pra gente concluir o nosso agendamento? Responda confirmo ou corrigir.`;
}
export async function conduzirCadastro(porta: PortaCadastroConsulta, mensagemId: string, texto: string, iniciar = false): Promise<string | null> {
  let d = await porta.ler();
  if (d?.ultimaMensagem === mensagemId && d.ultimaResposta) return d.ultimaResposta;
  if ((!d || d.etapa === "encerrado") && !iniciar) return null;
  if (!await porta.ativo()) throw new Error("Cadastro pausado.");
  const responder = async (resposta: string) => {
    if (!await porta.ativo()) throw new Error("Cadastro pausado.");
    await porta.salvar({ ...d!, ultimaMensagem: mensagemId, ultimaResposta: resposta }); return resposta;
  };
  if (!d || d.etapa === "encerrado") {
    d = { id: randomUUID(), etapa: "dados", opcoes: [], paciente: {} };
    // Pedidos explícitos de disponibilidade continuam recebendo vagas reais imediatamente.
    if (/hor[aá]rio|vaga/iu.test(texto)) {
      d.opcoes = (await porta.vagas()).filter(v => v.disponivel).slice(0, 6);
      d.etapa = d.opcoes.length ? "horario" : "encerrado";
      return responder(menu(d.opcoes));
    }
    return responder(perguntaIdentificacao);
  }
  const entrada = texto.trim();
  if (/^(cancelar cadastro|parar cadastro|sair do cadastro)$/iu.test(entrada)) {
    d.etapa = "encerrado"; d.paciente = {}; return responder("Cadastro interrompido. Nenhuma consulta foi marcada por este cadastro.");
  }
  // Perguntas e pedidos fora do cadastro continuam no prompt, inclusive urgências e atendimento humano.
  if (/(?:falta de ar|dor no peito|urgência|urgencia|socorro|sintoma|atendente|humano|recepção|recepcao|remarcar|reagendar|cancelar consulta)/iu.test(entrada)) return null;
  if (d.etapa === "local" || (d.etapa === "horario" && /cama[çc]ari|semerge/iu.test(entrada))) {
    const camacari = /cama[çc]ari|semerge/iu.test(entrada); const salvador = /salvador|bonvida/iu.test(entrada);
    if (camacari && !salvador) {
      d.etapa = "encerrado"; d.paciente = {}; d.opcoes = []; d.horario = undefined;
      return responder(contatoCamacari);
    }
    if (!salvador || camacari) return responder(perguntaLocal);
    d.local = "salvador";
    if (d.horario) { d.etapa = "conferencia"; return responder(resumo(d)); }
    d.opcoes = (await porta.vagas()).filter(v => v.disponivel).slice(0, 6);
    d.etapa = d.opcoes.length ? "horario" : "encerrado";
    return responder(menu(d.opcoes));
  }
  if (d.etapa === "horario") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(entrada)) {
      try { d.opcoes = (await porta.vagas(entrada.split("/").reverse().join("-"))).filter(v => v.disponivel).slice(0, 6); }
      catch (erro) { return responder(erro instanceof ErroDeNegocio ? erro.message : "Confira a data: informe uma quinta-feira futura no formato dia/mês/ano."); }
      return responder(menu(d.opcoes));
    }
    const hora = horaInformada(entrada);
    if (!hora && entrada.includes("?") && !/hor[aá]rio|vaga|quinta|segunda|terça|quarta|sexta|sábado|domingo/iu.test(entrada)) return null;
    const candidatas = hora ? d.opcoes.filter(v => new Date(v.inicio).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) === hora) : [];
    const opcao = /^\d{1,2}$/.test(entrada) && d.opcoes[Number(entrada) - 1] || (candidatas.length === 1 ? candidatas[0] : undefined);
    if (!opcao) return responder(menu(d.opcoes));
    d.horario = opcao; d.etapa = camposPendentes(d.paciente).length ? "dados" : d.local ? "conferencia" : "local";
    return responder(d.etapa === "conferencia" ? resumo(d) : d.etapa === "local" ? perguntaLocal : perguntaDados(d.paciente));
  }
  if (entrada.includes("?")) return null;
  if (d.etapa === "conferencia") {
    // Cadastros anteriores à escolha de unidade já eram exclusivos de Salvador.
    d.local ??= "salvador";
    if (/^(corrigir|não|nao)$/iu.test(entrada)) { d.paciente = {}; d.etapa = "dados"; return responder(perguntaIdentificacao); }
    if (!/^(sim|confirmo|confirmar|está correto|esta correto|pode agendar)[.!]?$/iu.test(entrada)) return responder(resumo(d));
    const paciente = pacienteSchema.parse(d.paciente);
    try {
      if (!await porta.ativo()) throw new Error("Cadastro pausado.");
      const reserva = await porta.reservar({ horarioId: d.horario!.id, paciente, dadosConferidos: true }, d.id);
      d.etapa = "encerrado"; d.paciente = {};
      return responder(`Consulta confirmada para ${formatarConsulta(reserva.inicio)} (horário de Brasília), em nome de ${reserva.nomeCompleto}. Protocolo: ${reserva.id}.\nO seu cadastro foi registrado em nosso sistema.`);
    } catch (erro) {
      if (!(erro instanceof ErroDeNegocio)) throw erro;
      d.opcoes = (await porta.vagas(d.horario!.inicio.slice(0, 10), d.horario!.inicio)).filter(v => v.disponivel).slice(0, 6); d.etapa = d.opcoes.length ? "horario" : "encerrado";
      return responder(`${erro.message}\n${menu(d.opcoes)}`);
    }
  }
  if (!porta.extrair) throw new Error("Extração de cadastro indisponível.");
  const extraidos = await porta.extrair(entrada, [...campos]);
  let erro = "";
  for (const campo of campos) {
    if (extraidos[campo] === undefined) continue;
    const valor = pacienteSchema.shape[campo].safeParse(normalizarCampo(campo, extraidos[campo]!));
    if (valor.success) d.paciente = { ...d.paciente, [campo]: valor.data };
    else erro ||= valor.error.issues[0].message;
  }
  if (erro) return responder(`${erro}\n${camposPendentes(d.paciente).length ? perguntaDados(d.paciente) : "Corrija esse dado para continuar."}`);
  if (camposPendentes(d.paciente).length) return responder(perguntaDados(d.paciente));
  d.paciente = pacienteSchema.parse({ ...d.paciente, complemento: d.paciente.complemento ?? "" });
  d.etapa = "local"; return responder(perguntaLocal);
}
