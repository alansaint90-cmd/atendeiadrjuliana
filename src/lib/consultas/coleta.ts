import { pacienteSchema, type PacienteConsulta } from "./schema";
import { dataNumerica, numerosDaFala } from "./linguagem";

export type CampoPaciente = keyof PacienteConsulta;
const identificacao = ["nomeCompleto", "idade"] as const;
const endereco = ["rua", "numero", "bairro", "cidade"] as const;
export const perguntaIdentificacao = "Qual é o nome completo do paciente?";
export const perguntaEndereco = "Qual é o endereço completo do paciente? Informe rua, bairro, número, cidade, e um ponto de referência, se houver.";
export const perguntaLocal = "Você gostaria de agendar uma consulta em Salvador ou em Camaçari?";
const rotulos: Record<CampoPaciente, string> = { nomeCompleto: "nome completo", idade: "idade em anos completos", nascimento: "data de nascimento (dia, mês e ano)",
  rua: "rua", numero: "número ou s/n", bairro: "bairro", cidade: "cidade do endereço", uf: "UF", complemento: "ponto de referência",
  telefone: "telefone", cep: "CEP" };
export function camposPendentes(paciente: Partial<PacienteConsulta>): CampoPaciente[] {
  const falta = (campos: readonly CampoPaciente[]) => campos.filter(c => (c === "idade" && !paciente[c]) || !pacienteSchema.shape[c].safeParse(paciente[c]).success);
  const pessoal = falta(identificacao).filter(c => c !== "idade" || !paciente.nascimento || !pacienteSchema.shape.nascimento.safeParse(paciente.nascimento).success);
  return pessoal.length ? pessoal : falta(endereco);
}
export function perguntaDados(paciente: Partial<PacienteConsulta>) {
  const pendentes = camposPendentes(paciente);
  if (pendentes.includes("nomeCompleto")) return perguntaIdentificacao;
  if (pendentes.includes("idade")) return "Qual é a sua idade?";
  if (pendentes.length === endereco.length && pendentes[0] === "rua") return perguntaEndereco;
  return `Para completar o cadastro, informe: ${pendentes.map(c => rotulos[c]).join(", ")}.`;
}
export function normalizarCampo(campo: CampoPaciente, texto: string) {
  if (campo === "telefone") {
    const numeros = texto.replace(/[\s()+.-]/g, "");
    return /^(?:\d{10}|\d{11})$/.test(numeros) && !texto.startsWith("+") ? `+55${numeros}` : `+${numeros}`;
  }
  if (campo === "cep") return texto.replace(/[\s.-]/g, "");
  if (campo === "idade") return numerosDaFala(texto).replace(/^(?:tenho|tem|idade[: ]*)\s*/u, "").replace(/\s*anos?[.!?]?$/u, "").trim();
  if (campo === "nascimento") return dataNumerica(texto);
  if (campo === "numero") return numerosDaFala(texto);
  if (campo === "uf") return texto.toUpperCase();
  return texto;
}
