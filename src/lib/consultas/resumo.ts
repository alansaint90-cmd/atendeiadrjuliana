import { sql } from "drizzle-orm";
import { linhas, type BancoSql } from "../db/porta";
import { agendaHorarios, agendaReservas } from "../db/schema/agenda-consultas";
import { vivos } from "../db/soft-delete";
import { horariosDoDia, proximasQuintas } from "./calendario";

export interface ResumoAgenda { dia: string; confirmadas: number; livres: string[] }

/** Leitura agregada da agenda única, sem criar vagas nem retornar dados de pacientes. */
export async function consultarResumoAgenda(banco: BancoSql, agora = Date.now()): Promise<ResumoAgenda> {
  const dia = proximasQuintas(agora).find(data => horariosDoDia(data, agora).length > 0)!;
  const reservas = linhas<{ inicio: string }>(await banco.execute(sql`
    SELECT inicio FROM atendeia_agenda_horarios
    JOIN atendeia_agenda_horarios_reservas ON horario_id=atendeia_agenda_horarios.id
    WHERE ${vivos(agendaHorarios)} AND ${vivos(agendaReservas)} AND status='confirmada'
      AND inicio>=${dia + "T00:00:00-03:00"}::timestamptz
      AND inicio<${dia + "T00:00:00-03:00"}::timestamptz + interval '1 day'`));
  const ocupados = new Set(reservas.map(r => new Date(r.inicio).toISOString()));
  return { dia, confirmadas: reservas.length,
    livres: horariosDoDia(dia, agora).filter(h => !ocupados.has(h.inicio)).map(h => h.inicio) };
}
