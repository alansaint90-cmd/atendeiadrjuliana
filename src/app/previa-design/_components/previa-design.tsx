"use client";

import { useEffect, useState } from "react";
import { PainelShell } from "@/components/painel-shell";
import { icon } from "@/lib/demo/icons";
import { AgendaPrevia } from "./agenda-previa";
import "./previa.css";
import { ResumoClinica } from "@/components/operacao/resumo-clinica";

const indicadores = { abertas: 24, pendentes: 0, atendimentoIa: 18, atendimentoHumano: 6,
  novas: 24, atendidasIa: 18, atendidasHumano: 6, totalAtendidas: 24, canais: [], contatos: [], evolucao: [], atualizadoEm: "2026-10-13T12:00:00.000Z" };

export function PreviaDesign() {
  const [rota, setRota] = useState("dashboard");
  const [visual, setVisual] = useState("novo");
  useEffect(() => {
    document.documentElement.dataset.visual = visual;
    return () => { delete document.documentElement.dataset.visual; };
  }, [visual]);
  const titulo = rota === "consultas" ? "Agenda de consultas" : "Dashboard";
  return <PainelShell papel="admin" nome="Dra. Juliana" email="Prévia local" rota={rota} titulo={titulo}
    aoNavegar={setRota} rotasVisiveis={["dashboard", "consultas"]}
    rodape={<div className="account"><div className="account-identity"><span className="account-avatar">DJ</span><span className="account-details"><strong>Dra. Juliana</strong><small>Clínica Bonvida</small></span></div></div>}>
    <main className="content">
      <div className="previa-aviso"><div><strong>Prévia do design</strong><span>Dados fictícios · nenhuma alteração na agenda real</span></div>
        <div className="previa-comparador" role="group" aria-label="Comparar aparência">
          <button className={visual === "atual" ? "primary" : "secondary"} aria-pressed={visual === "atual"} onClick={() => setVisual("atual")}>Visual atual</button>
          <button className={visual === "novo" ? "primary" : "secondary"} aria-pressed={visual === "novo"} onClick={() => setVisual("novo")}>Novo design</button>
        </div>
      </div>
      {rota === "consultas" ? <AgendaPrevia /> : <div className="page-stack dashboard-page">
        <ResumoClinica dados={indicadores} periodo="Últimos 7 dias" podeVerAgenda aoVerAgenda={() => setRota("consultas")}
          agenda={{ dia: "2026-10-15", confirmadas: 4, livres: ["2026-10-15T13:40:00.000Z", "2026-10-15T14:20:00.000Z"] }} />
        <div className="previa-colunas"><section className="panel"><div className="panel-title"><div><h2>Próximas consultas</h2><p>Quinta-feira, 15 de outubro · horário de Brasília</p></div><span className="badge green">4 confirmadas</span></div>
          <div className="table"><table><thead><tr><th>Paciente</th><th>Horário</th><th>Status</th></tr></thead><tbody>
            {["Marina Oliveira", "Pedro Almeida", "Clara Santos", "Lucas Costa"].map((nome, i) => <tr key={nome}><td><div className="previa-paciente"><span className="avatar">{nome.split(" ").map(n => n[0]).join("")}</span><div><strong>{nome}</strong><small>Paciente fictício</small></div></div></td><td>{["08:00", "08:40", "09:20", "10:00"][i]}</td><td><span className="badge green">Confirmada</span></td></tr>)}
          </tbody></table></div><button className="secondary previa-ver-agenda" onClick={() => setRota("consultas")}>Ver todos os horários</button>
        </section><aside className="page-stack"><section className="panel previa-assistente"><span className="previa-icone" dangerouslySetInnerHTML={{ __html: icon("spark") }} /><h2>Ayala, sua assistente</h2><p>Recepção e agendamento em uma conversa mais simples.</p><div className="previa-passos"><span>01 <strong>Acolher o paciente</strong></span><span>02 <strong>Consultar horários livres</strong></span><span>03 <strong>Conferir e confirmar os dados</strong></span></div><small>Ilustração do fluxo de atendimento</small></section>
          <section className="panel"><h2>Uma manhã bem organizada</h2><p>Atendimento às quintas-feiras, com seis horários entre 8h e 11h20.</p><span className="badge blue">Consultas de 40 minutos</span></section></aside></div>
      </div>}
    </main>
  </PainelShell>;
}
