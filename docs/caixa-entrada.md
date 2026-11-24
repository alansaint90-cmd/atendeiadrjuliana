# Caixa de entrada e atendimento manual

A caixa de entrada usa `src/components/conversas/caixa-entrada.tsx`: busca por nome/telefone/canal, lista e histórico, datas e horários em Salvador, atualização a cada dez segundos e navegação responsiva. Mantém as últimas cinquenta conversas e cinquenta mensagens por conversa. A rolagem acompanha mensagens novas sem deslocar quem está lendo mensagens anteriores.

As ações `assumirAtendimento`, `enviarMensagemManual` e `validarCanalAtendimento`, em `src/lib/actions/atendimento.ts`, exigem sessão e papel mínimo operador. O servidor revalida o usuário ativo. Para enviar é necessário assumir a conversa; somente o atendente responsável envia. A tomada humana bloqueia respostas da IA e follow-ups automáticos no worker. Devolver à IA remove a tomada humana, preservando as regras de ativação e as pausas externas existentes do WhatsApp.

O compositor permite texto, emojis, imagem com legenda, áudio anexado ou gravado, vídeo e PDF/DOCX. Arquivos são limitados a dois MB e validados por conteúdo e tipo no servidor. A gravação dura no máximo sessenta segundos e permite prévia antes do envio. Entregas incertas não são repetidas automaticamente: confira o histórico e o WhatsApp antes de tentar outro envio.

A tabela `atendeia_atendimento_envios` reserva uma chave única por envio para evitar duplicações. A migração `0016_dusty_albert_cleary.sql` cria essa tabela e acrescenta a coluna opcional `foto_url` a contatos, sem apagar registros. Execute em produção somente após backup verificado. Fotos recebidas por eventos de contato só atualizam contatos já vinculados à instância autenticada; na ausência de foto, aparecem iniciais.

A rota autenticada `/api/conversas/mensagens/[id]/audio` exige operador, consulta o chip e ID do provedor no banco, valida disponibilidade e exclusão lógica e devolve áudio com suporte a Range, sem cache público. Não aceita URL de mídia fornecida pelo cliente.

A prévia local `/previa-design` inclui a opção Caixa de entrada com dados fictícios e envio desativado. A aplicação completa continua exigindo PostgreSQL, sessão e integrações configuradas. Nenhuma mensagem real é enviada pelos testes.
