# ADR-0013: Agenda de consultas e cadastro completo

- Data: 2026-10-12
- Status: implementado para validação; implantação depende de backup e migração.

O módulo anterior agenda mensagens, não consultas. A clínica pediu uma agenda
própria com seis horários de quinta-feira, a cada 40 minutos, de 8h a 11h20 como
horários de início. A agenda é única da médica em Salvador, compartilhada pelos
chips habilitados; a conversa e o rascunho do paciente permanecem isolados.

Tabelas aditivas `atendeia_agenda_horarios` e `atendeia_agenda_horarios_reservas`
usam auditoria, precisão de milissegundos, FK restrict e exclusão lógica. A reserva
bloqueia a linha da vaga e o índice parcial único impede duas reservas confirmadas.
Uma chave de solicitação permite recuperar o resultado sem criar outra reserva.
Não há promessa de entrega exatamente uma vez entre PostgreSQL, Redis e WhatsApp.

A IA apenas inicia o fluxo. A coleta e a confirmação são conduzidas pelo servidor,
com validação por campo e conferência explícita do paciente. O cadastro temporário
fica no Redis por 24h; o histórico de 12 falas não é suficiente para dez campos.
Não se deduz endereço por CEP nem se usa nome de exibição como nome do paciente.
Dados incompletos não chegam ao repositório de reservas. Mensagens de confirmação
só são produzidas após o commit; o diário existente não repete entrega incerta.

O painel exige gerente ou superior. O worker só usa a instância do evento
autenticado e revalida habilitação, configuração, pausa humana e lease antes da
reserva. O chatbot deve habilitar explicitamente `agendaConsultas`. A agenda não
é usada para o Hospital SEMERGE, não cria lembretes e não modifica campanhas.

As actions `carregarAgendaConsultas`, `confirmarConsulta` e
`cancelarConsultaAgendada`, em `src/lib/actions/consultas.ts`, validam sessão,
permissão e entrada antes de chamar o repositório compartilhado com o worker.

Auditoria guarda ação e identificador, sem endereço ou nascimento. O cadastro é
acessível somente na agenda administrativa. Cancelamento preserva histórico e
libera o horário, sem mensagem automática. Testes usam PostgreSQL isolado/PGlite,
Redis simulado para o cadastro e provedores simulados; sem pacientes reais.
