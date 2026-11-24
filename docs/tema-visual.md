# Tema visual compartilhado

O painel da Dra. Juliana utiliza o tema visual `src/styles/atende-pro.css`, adaptado de `atende ai ct luiz roca/sistema`.

A camada é importada por último no layout e ativada pela classe `tema-atende-pro` em `PainelShell`. Define cores, tipografia, navegação, cartões, formulários, tabelas e comportamento visual responsivo. A fonte Inter é servida localmente em `src/app/_fonts/inter-latin.woff2`.

As regras médicas, permissões, rotas, campanhas, agendamentos, autenticação e persistência permanecem nas implementações da Juliana. Não copiar componentes ou serviços de negócio do CT para atualizar a aparência.
