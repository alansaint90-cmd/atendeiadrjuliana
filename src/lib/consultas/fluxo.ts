import { randomUUID } from "node:crypto";
import { ErroDeNegocio } from "../acao";
import { pacienteSchema, formatarConsulta, type PacienteConsulta, type HorarioConsulta, type Consulta } from "./schema";

const campos = ["nomeCompleto", "telefone", "nascimento", "cep", "rua", "numero", "complemento", "bairro", "cidade", "uf"] as const;
export const perguntasCadastro: Record<keyof PacienteConsulta, string> = {
  nomeCompleto: "Qual é o nome completo do paciente?", telefone: "Qual é o telefone para contato, com DDD?",
  nascimento: "Qual é a data de nascimento do paciente? Informe dia/mês/ano.", cep: "Qual é o CEP do endereço do paciente?",
  rua: "Qual é o nome da rua ou avenida?", numero: "Qual é o número? Se não houver, informe s/n.",
  complemento: "Há complemento, como apartamento ou bloco? Se não houver, responda sem complemento.",
  bairro: "Qual é o bairro?", cidade: "Qual é a cidade?", uf: "Qual é a sigla do estado? Por exemplo, BA.",
};
export interface CadastroConsulta { id: string; etapa: "horario" | "dados" | "conferencia" | "encerrado"; opcoes: HorarioConsulta[];
  horario?: HorarioConsulta; paciente: Partial<PacienteConsulta>; ultimaMensagem?: string; ultimaResposta?: string }
export interface PortaCadastroConsulta {
  ler(): Promise<CadastroConsulta | null>; salvar(dados: CadastroConsulta): Promise<void>;
  vagas(dia?: string, depoisDe?: string): Promise<HorarioConsulta[]>; reservar(dados: { horarioId: string; paciente: PacienteConsulta; dadosConferidos: true }, identidade: string): Promise<Consulta>;
  ativo(): Promise<boolean>;
}
function menu(opcoes: HorarioConsulta[]) {
  return opcoes.length ? `Estes são os próximos horários livres (horário de Brasília):\n${opcoes.map((v, i) => `${i + 1}. ${formatarConsulta(v.inicio)}`).join("\n")}\nQual opção você prefere? Responda com o número ou informe outra data no formato dia/mês/ano. A vaga só é reservada após o cadastro completo.`
    : "Não encontrei vagas disponíveis. A equipe precisa verificar a agenda; nenhuma consulta foi marcada.";
}
function resumo(d: CadastroConsulta) {
  const p = pacienteSchema.parse(d.paciente);
  return `Confira os dados antes de agendar:\n${p.nomeCompleto}\nTelefone: ${p.telefone}\nNascimento: ${p.nascimento.split("-").reverse().join("/")}\nEndereço: ${p.rua}, ${p.numero}${p.complemento ? `, ${p.complemento}` : ""}, ${p.bairro}, ${p.cidade}/${p.uf}, CEP ${p.cep}\nConsulta: ${formatarConsulta(d.horario!.inicio)} (Brasília).\nOs dados e o horário estão corretos? Responda confirmo ou corrigir. A consulta ainda não está confirmada.`;
}
export function normalizarCampo(campo: keyof PacienteConsulta, texto: string) {
  if (campo === "telefone") {
    const numeros = texto.replace(/[\s()+.-]/g, "");
    return /^(?:\d{10}|\d{11})$/.test(numeros) && !texto.startsWith("+") ? `+55${numeros}` : `+${numeros}`;
  }
  if (campo === "cep") return texto.replace(/[\s.-]/g, "");
  if (campo === "nascimento" && /^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto.split("/").reverse().join("-");
  if (campo === "uf") return texto.toUpperCase();
  if (campo === "complemento" && /^(sem complemento|não|nao|nenhum|não tem|nao tem)$/iu.test(texto)) return "";
  return texto;
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
    const opcoes = (await porta.vagas()).filter(v => v.disponivel).slice(0, 6);
    d = { id: randomUUID(), etapa: opcoes.length ? "horario" : "encerrado", opcoes, paciente: {} };
    return responder(menu(opcoes));
  }
  const entrada = texto.trim();
  if (/^(cancelar cadastro|parar cadastro|sair do cadastro)$/iu.test(entrada)) {
    d.etapa = "encerrado"; d.paciente = {}; return responder("Cadastro interrompido. Nenhuma consulta foi marcada por este cadastro.");
  }
  // Perguntas e pedidos fora do cadastro continuam no prompt, inclusive urgências e atendimento humano.
  if (/[?]|(?:falta de ar|dor no peito|urgência|urgencia|socorro|sintoma|atendente|humano|recepção|recepcao)/iu.test(entrada)) return null;
  if (d.etapa === "horario") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(entrada)) {
      try { d.opcoes = (await porta.vagas(entrada.split("/").reverse().join("-"))).filter(v => v.disponivel).slice(0, 6); }
      catch (erro) { return responder(erro instanceof ErroDeNegocio ? erro.message : "Confira a data: informe uma quinta-feira futura no formato dia/mês/ano."); }
      return responder(menu(d.opcoes));
    }
    const opcao = /^\d{1,2}$/.test(entrada) ? d.opcoes[Number(entrada) - 1] : undefined;
    if (!opcao) return responder(menu(d.opcoes));
    d.horario = opcao; d.etapa = Object.keys(d.paciente).length === campos.length ? "conferencia" : "dados";
    return responder(d.etapa === "conferencia" ? resumo(d) : `Para cadastrar a consulta, preciso dos dados do paciente. ${perguntasCadastro[campos.find(c => d!.paciente[c] === undefined)!]}\nSe precisar interromper, escreva cancelar cadastro.`);
  }
  if (d.etapa === "conferencia") {
    if (/^(corrigir|não|nao)$/iu.test(entrada)) { d.paciente = {}; d.etapa = "dados"; return responder(perguntasCadastro.nomeCompleto); }
    if (!/^(sim|confirmo|confirmar|está correto|esta correto|pode agendar)[.!]?$/iu.test(entrada)) return responder(resumo(d));
    const paciente = pacienteSchema.parse(d.paciente);
    try {
      if (!await porta.ativo()) throw new Error("Cadastro pausado.");
      const reserva = await porta.reservar({ horarioId: d.horario!.id, paciente, dadosConferidos: true }, d.id);
      d.etapa = "encerrado"; d.paciente = {};
      return responder(`Consulta confirmada para ${formatarConsulta(reserva.inicio)} (horário de Brasília), em nome de ${reserva.nomeCompleto}. Protocolo: ${reserva.id}.\nSeu cadastro foi registrado no Atende AI.`);
    } catch (erro) {
      if (!(erro instanceof ErroDeNegocio)) throw erro;
      d.opcoes = (await porta.vagas(d.horario!.inicio.slice(0, 10), d.horario!.inicio)).filter(v => v.disponivel).slice(0, 6); d.etapa = d.opcoes.length ? "horario" : "encerrado";
      return responder(`${erro.message}\n${menu(d.opcoes)}`);
    }
  }
  const campo = campos.find(c => d!.paciente[c] === undefined);
  if (!campo) { d.etapa = "conferencia"; return responder(resumo(d)); }
  const valor = pacienteSchema.shape[campo].safeParse(normalizarCampo(campo, entrada));
  if (!valor.success) return responder(`${valor.error.issues[0].message}\n${perguntasCadastro[campo]}`);
  // Só o conteúdo informado pelo paciente preenche o cadastro; a IA não inventa campos.
  d.paciente = { ...d.paciente, [campo]: valor.data };
  const seguinte = campos.find(c => d!.paciente[c] === undefined);
  if (seguinte) return responder(perguntasCadastro[seguinte]);
  d.etapa = "conferencia"; return responder(resumo(d));
}
