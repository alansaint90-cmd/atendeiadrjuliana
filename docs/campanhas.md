# Campanhas para a base existente

A área Campanhas permite criar um rascunho com texto e um anexo JPG, PNG, MP3, OGG ou PDF de até 2 MB, selecionar todos os contatos elegíveis ou marcar contatos específicos, revisar e iniciar o envio mediante confirmação. Um rascunho não envia mensagens. Não há importação de listas nem campo para cadastrar telefones.

## Destinatários e permissões
Somente administradores e superadministradores acessam as actions em `src/lib/actions/campanhas.ts`. A seleção usa exclusivamente IDs de contatos com telefone válido e mensagem **recebida** em conversa do chip Evolution selecionado. Contato apenas cadastrado, importado, com mensagens só de saída ou com histórico em outro chip não é elegível. O telefone atual deve corresponder ao endereço WhatsApp da conversa recebida; trocar o telefone de um contato não autoriza atingir outro número. Trocar o chip limpa a seleção. “Selecionar todos” seleciona a lista completa daquele chip, independentemente do filtro de busca; o limite por campanha é 5.000 contatos.

`src/lib/campanhas/repository.ts` valida os IDs no servidor e repete a verificação imediatamente antes do envio. Exclusão lógica de contato, conversa, canal ou mensagem de entrada e mudança de telefone impedem o envio. Estado e auditoria são persistidos nas tabelas `atendeia_campanhas` e `atendeia_campanha_destinatarios`, com migração versionada. As tabelas legadas `atendeia_campaigns` e `atendeia_campaign_recipients` permanecem preservadas e não são usadas pelo novo processador.

## Conteúdo e execução
O anexo é persistido em base64 e validado por tipo, assinatura e tamanho. URLs remotas não são aceitas. O limite da Server Action permanece 4 MB. Texto sem anexo usa sendText; imagem e PDF usam sendMedia com legenda; áudio usa sendWhatsAppAudio, precedido do texto quando preenchido. Arquivos de campanha não são listas de destinatários.

`src/lib/campanhas/worker.ts` é chamado pelo processador já existente de agendamentos e depende de ATENDEIA_WORKER_ENABLED. Envia um destinatário por chip por ciclo, com intervalo mínimo de 10 segundos por campanha, reserva transacional e trava de linha. O chip e as credenciais são revalidados antes do envio.

A confirmação de iniciar usa versão para evitar iniciar duas vezes. Cancelar a campanha cancela pendências; um envio já em andamento poderá terminar. Envios enviados ou incertos não voltam à fila. Uma queda após a reserva passa o destinatário a incerto após cinco minutos. Timeouts e respostas sem confirmação também ficam incertos e exigem conferência manual; não há reenvio automático, inclusive quando texto de um áudio já saiu. O status enviado significa aceitação pelo provedor, não entrega ou leitura.

## Interface e validação
A interface em `src/components/campanhas/page.tsx` oferece busca, seleção individual, seleção de toda a base elegível, prévia de texto, imagem e áudio, confirmação de rascunho/início/cancelamento, contadores e resultado por contato. A lista de campanhas mostra as 100 mais recentes; resultados são atualizados pelo botão Atualizar resultados.

Testes em `tests/campanhas.test.ts` verificam migração, contatos sem histórico, isolamento de chip, adulteração de destinatários, cancelamento, queda durante envio, entrega incerta, formatos e contrato de envio. `tests/campanhas-page.test.tsx` verifica seleção e confirmação sem iniciar a campanha implicitamente. Nenhum teste envia mensagens a contatos reais.

Actions: `carregarCampanhas` carrega campanhas e base elegível; `gravarCampanha` salva rascunho; `iniciarCampanha` confirma o início; `cancelarCampanha` cancela pendências; `detalharCampanha` lista resultados por contato.
