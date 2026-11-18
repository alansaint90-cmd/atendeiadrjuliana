import { afterEach,expect,test,vi } from "vitest";
import { cleanup,fireEvent,render,screen,act } from "@testing-library/react";
import { AgendamentosPage } from "@/components/agendamentos/page";
import { carregarFilaMensagens,alterarFilaMensagens } from "@/lib/actions/fila-mensagens";
import type { MensagemFila } from "@/lib/agendamentos/fila-schema";
vi.mock("@/lib/actions/fila-mensagens",()=>({carregarFilaMensagens:vi.fn(),alterarFilaMensagens:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
const item=(origem:MensagemFila["origem"],id:string):MensagemFila=>({origem,id,versao:"1",data:"2026-11-19T10:00:00Z",telefone:"+5511999999999",instancia:"teste",mensagem:"Mensagem "+origem,status:"pendente",origemNome:origem==="campanha"?"Campanha novembro":origem==="followup"?"Follow-up · etapa 1":"Envio individual",lixeira:false,previsao:origem==="campanha"});
const carga=(itens:MensagemFila[],avisos:string[]=[])=>vi.mocked(carregarFilaMensagens).mockResolvedValue({ok:true,dados:{itens,avisos,ativo:true}});
async function confirmar(){for(let i=0;i<3;i++)await act(()=>vi.advanceTimersByTimeAsync(1000));await act(async()=>{fireEvent.click(screen.getByRole("button",{name:"Confirmar"}));});vi.useRealTimers();}
test("lista mostra origem e cancela selecionadas somente depois da confirmação",async()=>{
 carga([item("campanha","a"),item("followup","b"),item("individual","c")]);vi.mocked(alterarFilaMensagens).mockResolvedValue({ok:true,dados:{alterados:3,naoAlterados:0,avisos:[]}});
 render(<AgendamentosPage/>);await screen.findByText("Campanha novembro");expect(screen.getByText("Follow-up · etapa 1")).toBeInTheDocument();expect(screen.getByRole("columnheader",{name:"Origem"})).toBeInTheDocument();expect(screen.queryByText("+ Novo agendamento")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("checkbox",{name:"Selecionar todas deste filtro"}));vi.useFakeTimers();fireEvent.click(screen.getByText("Cancelar selecionadas (3)"));expect(alterarFilaMensagens).not.toHaveBeenCalled();await confirmar();
 expect(alterarFilaMensagens).toHaveBeenCalledWith({acao:"cancelar",alvos:[{id:"a",origem:"campanha",versao:"1"},{id:"b",origem:"followup",versao:"1"},{id:"c",origem:"individual",versao:"1"}]});
});
test("lixeira permite restaurar sem reativar e lista parcial bloqueia todas",async()=>{
 carga([{...item("campanha","a"),lixeira:true,status:"cancelado"}], ["Lista parcial"]);vi.mocked(alterarFilaMensagens).mockResolvedValue({ok:true,dados:{alterados:1,naoAlterados:0,avisos:[]}});
 render(<AgendamentosPage/>);await screen.findByText("Lista parcial");fireEvent.click(screen.getByRole("button",{name:"Lixeira",exact:true}));expect(screen.getByText("Campanha novembro")).toBeInTheDocument();expect(screen.getByText("Restaurar todas deste filtro")).toBeDisabled();
 vi.useFakeTimers();fireEvent.click(screen.getByRole("button",{name:"Restaurar registro",exact:true}));expect(screen.getByText(/Nenhum envio será reativado/)).toBeInTheDocument();await confirmar();expect(alterarFilaMensagens).toHaveBeenCalledWith(expect.objectContaining({acao:"restaurar"}));
});
