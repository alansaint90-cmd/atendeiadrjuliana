import test from "node:test";
import assert from "node:assert/strict";
import { conduzirCadastro, type CadastroConsulta, type PortaCadastroConsulta } from "../src/lib/consultas/fluxo";
import type { HorarioConsulta } from "../src/lib/consultas/schema";

for (const etapa of ["dados", "local", "horario", "conferencia"] as const) {
  test(`dúvidas durante ${etapa} recebem preço e vagas sem exigir endereço`, async () => {
    let estado: CadastroConsulta = { id: "cadastro", etapa, paciente: { nomeCompleto: "Maria Exemplo", nascimento: "1990-02-20" }, opcoes: [] };
    let consultas = 0;
    const vaga = { id: "vaga-real", inicio: "2026-10-22T11:00:00Z", disponivel: true } as HorarioConsulta;
    const porta: PortaCadastroConsulta = {
      ativo: async () => true, ler: async () => estado, salvar: async d => { estado = d; },
      vagas: async () => { consultas++; return [vaga]; },
      extrair: async () => { throw Error("Pergunta não é dado pessoal"); },
      reservar: async () => { throw Error("Não reservar ao informar preços"); },
    };
    const preco = await conduzirCadastro(porta, "preco", "Gostaria de saber antes o valor da consulta");
    assert.match(preco!, /400,00.*Pix.*430,00.*215,00/s);
    assert.ok(preco!.indexOf("400,00") < preco!.indexOf("Retomando seu agendamento:"));
    assert.match(preco!, /Retomando seu agendamento:/);
    if (etapa === "dados") assert.match(preco!, /endereço completo/);
    assert.doesNotMatch(preco!, /nome completo/);
    assert.equal(estado.etapa, etapa);
    assert.equal(consultas, 0);
    const combinado = await conduzirCadastro(porta, "ambos", "Gostaria de saber o valor da consulta e os horários disponíveis");
    assert.match(combinado!, /400,00/);
    assert.match(combinado!, /22\/10\/2026|22\/10/);
    assert.match(combinado!, /08:00/);
    assert.equal(consultas, 1);
    assert.equal(estado.paciente.nomeCompleto, "Maria Exemplo");
    assert.equal(estado.paciente.nascimento, "1990-02-20");
    const endereco = await conduzirCadastro(porta, "endereco", "Qual o endereço da clínica");
    assert.match(endereco!, /Bonvida.*1541.*7024/s);
    assert.ok(endereco!.indexOf("Bonvida") < endereco!.indexOf("Retomando seu agendamento:"));
    assert.equal(estado.etapa, etapa);
  });
}
test("outras dúvidas não repetem coleta e preço de Camaçari não recebe tabela de Salvador", async () => {
  let estado: CadastroConsulta = { id: "cadastro", etapa: "dados", paciente: {}, opcoes: [] };
  const porta: PortaCadastroConsulta = { ativo: async () => true, ler: async () => estado, salvar: async d => { estado = d; },
    vagas: async () => [], extrair: async () => ({}), reservar: async () => { throw Error("Não reservar"); } };
  assert.equal(await conduzirCadastro(porta, "crianca", "Atende criança de cinco anos"), null);
  assert.equal(await conduzirCadastro(porta, "camacari", "Qual o valor em Camaçari"), null);
  assert.deepEqual(estado.paciente, {});
});
