import { sql } from "drizzle-orm";
import { pgTable, uuid, text, check, uniqueIndex } from "drizzle-orm/pg-core";
import { conversations, users } from "../schema";
import { colunasAuditoria } from "./_compartilhado";
import { STATUS_ENVIO_ATENDIMENTO, listaSql } from "./_enums";

export const enviosAtendimento = pgTable("atendeia_atendimento_envios", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversaId: uuid("conversa_id").notNull().references(() => conversations.id, { onDelete: "restrict", onUpdate: "restrict" }),
  chave: uuid("chave").notNull(), status: text("status").notNull().default("enviando"), provedorId: text("provedor_id"),
  ...colunasAuditoria,
  modified_by: uuid("modified_by").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "restrict" }),
}, t => [uniqueIndex("atendeia_atendimento_chave").on(t.chave),
  check("atendeia_atendimento_status", sql`${t.status} IN (${sql.raw(listaSql(STATUS_ENVIO_ATENDIMENTO))})`)]);
