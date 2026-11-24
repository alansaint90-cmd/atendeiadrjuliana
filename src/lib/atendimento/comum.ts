import { sql } from "drizzle-orm";
import { z } from "zod";
import { ErroDeNegocio } from "../acao";
import { linhas, type TransacaoSql } from "../db/porta";
import type { SessaoAtiva } from "../auth/permissoes";

export async function autorizar(tx: TransacaoSql, ator: SessaoAtiva) {
  z.uuid().parse(ator.userId);
  const [usuario] = linhas<{ role: string }>(await tx.execute(sql`SELECT role FROM atendeia_users WHERE id=${ator.userId} AND enabled=true AND is_deleted=false`));
  if (!usuario || !["super_admin", "admin", "operador"].includes(usuario.role)) throw new ErroDeNegocio("Sem permissão para esta operação.");
  return ator.userId;
}
export async function auditar(tx: TransacaoSql, autor: string, id: string, acao: string) {
  await tx.execute(sql`INSERT INTO atendeia_audit_logs(action,entity_type,entity_id,changed_fields,modified_by)
    VALUES (${acao},'atendimento',${id},'["operacao"]'::jsonb,${autor})`);
}
