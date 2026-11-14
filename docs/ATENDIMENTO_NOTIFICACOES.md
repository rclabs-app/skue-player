# Atendimento a suporte e notificações

Data: 12/11/2026. Estado: estrutura técnica e procedimento preparados; operação ainda não ativada.

## Situação confirmada

- O usuário informou que a caixa de atendimento ainda não existe. Não há responsável identificado nem recebimento/resposta comprovados nesta etapa.
- O endereço previsto no projeto é `contato@skue.tv`; isso não significa que a caixa esteja operacional.
- O site oferece `/contato`, acessível sem login pelo rodapé. O app aponta para essa página nas configurações e utiliza o host Laravel configurado para o portal.
- Enquanto o canal estiver desativado, a página mostra “Canal em preparação” e não apresenta endereço ou botão de envio inoperante.
- A página não tem formulário, não cria tickets e não envia e-mails. Quando ativada, os botões abrem o cliente de e-mail com assunto de suporte ou notificação. O usuário decide enviar a mensagem.

## Papéis e decisões para ativação

Antes de habilitar o canal, registrar em local operacional privado:

1. Responsável principal por verificar a caixa e responder; substituto em sua ausência.
2. Endereço definitivo e confirmação de que a caixa está criada no provedor.
3. Frequência de verificação, prazo interno para confirmação inicial e prazo para revisão dos casos em aberto.
4. Contato de encaminhamento técnico e jurídico.
5. Pessoas com acesso à caixa/registro e critérios de retenção e descarte de mensagens/anexos.

Não foram definidos nomes ou prazos nesta implementação. Os prazos internos devem ser aprovados pelo responsável e comunicados de forma realista; não são apresentados aqui como prazo legal. Solicitações com efeitos jurídicos devem ser encaminhadas à assessoria para definição da resposta e das providências.

O primeiro processo pode usar uma caixa acompanhada e um registro privado simples. Não é necessário criar um sistema de tickets para começar. Não colocar mensagens de usuários, dados pessoais ou anexos no Git ou nos registros de sessões de IA.

## Fluxo operacional

1. **Receber e registrar.** Atribuir um identificador interno; registrar data de recebimento, categoria, responsável, contato de resposta e um resumo mínimo. Preservar a mensagem original somente no armazenamento privado aprovado.
2. **Triar.** Separar suporte técnico, relato de segurança, privacidade e notificação sobre direitos/conteúdo. Identificar urgência para encaminhamento interno, sem decidir automaticamente a procedência.
3. **Delimitar o recurso.** Identificar a página pública ou o recurso do Skue relacionado. Não pedir senha, chave de dispositivo, token ou URL privada de playlist. Se vierem dados sensíveis, restringir acesso e evitar copiá-los para respostas ou registros adicionais.
4. **Verificar informações.** Conferir o que foi relatado com o mínimo de dados necessário. Se faltar contexto, solicitar complemento específico por resposta privada. Não baixar listas, reproduzir fontes ou abrir anexos desconhecidos sem necessidade e autorização no atendimento.
5. **Encaminhar.** Levar falha do produto ao responsável técnico; questões de direitos, privacidade ou obrigação de retirada à assessoria competente. Registrar somente o encaminhamento e o estado do caso no controle resumido.
6. **Decidir e agir.** Registrar a decisão do responsável, sua justificativa e a providência executada, quando houver. Limitar a ação ao recurso e ao caso verificados; preservar dados de terceiros e evidências necessárias conforme orientação recebida.
7. **Responder.** Explicar de forma objetiva o que foi analisado, a providência adotada ou a informação que ainda falta. Não prometer solução ou remoção de material fora do controle do Skue.
8. **Acompanhar e encerrar.** Confirmar que a resposta foi enviada, registrar resultado/data e manter ou encerrar o acompanhamento. Aplicar a política aprovada de retenção; revisar periodicamente casos sem resposta.

Estados sugeridos: recebido, aguardando complemento, em análise técnica, em análise jurídica, providência em execução e encerrado. A alteração de estado não comprova que a providência ocorreu: manter referência à ação efetivamente executada.

## Limites de atuação

- O operador pode avaliar recursos próprios: páginas institucionais, contas/dispositivos, configurações armazenadas e infraestrutura que administra.
- Fontes de reprodução externas pertencem a terceiros. O Skue não pode prometer apagar material hospedado na origem ou comprovar autorização de toda fonte apenas por receber uma mensagem.
- Medidas em contas/configurações devem ser definidas para o caso concreto pelo responsável competente, sem exclusões globais ou bloqueios automáticos baseados somente no recebimento de denúncia.
- Não enviar dados de clientes a terceiros como encaminhamento padrão. Definir necessidade, destinatário e conteúdo antes de compartilhar.

## Registro mínimo do caso

Manter em armazenamento privado, com acesso apenas às pessoas designadas:

- Identificador, categoria e datas de recebimento/última atualização.
- Responsável e estado atual.
- Contato para resposta, referência à mensagem original e recurso público relacionado.
- Resumo dos fatos e informações ainda necessárias, sem credenciais ou conteúdo privado de playlists.
- Encaminhamento, decisão, providência efetivamente realizada e referência à resposta.
- Critério/data de revisão da retenção e encerramento.

Prazo de retenção, local do registro e responsáveis continuam pendentes. Um arquivo deste modelo no repositório não deve se tornar a base real de atendimento.

## Textos de resposta para revisão do responsável

Estes modelos são propostas operacionais. Não foram enviados a ninguém nem representam decisão jurídica.

**Confirmação inicial:** “Recebemos sua mensagem e a registramos sob a referência [identificador]. Vamos analisar as informações relacionadas ao recurso indicado. Se precisarmos de algum complemento, responderemos por este canal. Não envie senhas, tokens, chaves de dispositivo ou URLs privadas de listas.”

**Pedido de complemento:** “Para analisar a referência [identificador], precisamos de [informação específica]. Informe apenas o necessário e oculte dados de acesso em imagens. Não é necessário enviar sua playlist ou credenciais.”

**Resultado:** “Sobre a referência [identificador], analisamos [escopo verificado]. A providência adotada foi [ação comprovada], ou [justificativa do resultado aprovada pelo responsável]. [Próximo passo, se houver].”

Não usar uma mensagem automática como prova de solução. Não confirmar recebimento antes de a mensagem ter efetivamente chegado.

## Exercício documental com caso fictício

Este exercício demonstra a passagem pelas etapas; não é teste de entrega nem atendimento realizado pela equipe.

1. Entrada simulada `EXEMPLO-001`: um solicitante fictício comunica um link incorreto em uma página institucional fictícia, sem anexar credenciais.
2. Registro simulado: categoria suporte, resumo “link de navegação incorreto”, contato fictício e estado recebido.
3. Triagem simulada: o recurso é uma página própria, portanto encaminhamento técnico. O relato não requer acesso à lista do usuário.
4. Análise simulada: comparar destino do link com o destino esperado. Se o relato tratasse de direitos/retirada, a decisão seria encaminhada à assessoria.
5. Decisão simulada: corrigir somente o link identificado; verificar seu destino. Nenhum link real foi alterado por este exercício.
6. Resposta simulada: usar o modelo de resultado descrevendo a correção comprovada no cenário. Nenhuma mensagem foi enviada.
7. Encerramento simulado: registrar a referência da verificação e da resposta. Na operação real, isso só ocorre após a ação e o envio efetivos.

Falta executar um caso fictício pela caixa real, com o responsável designado, após sua criação.

## Ativação técnica e teste de entrega

1. Criar a caixa no provedor do domínio e configurar o recebimento/envio conforme a documentação desse provedor. O registro do domínio sozinho não cria e-mail.
2. Definir responsável, substituto, acompanhamento e retenção.
3. Com autorização e destinatários definidos, enviar uma mensagem de teste sem dados de clientes; confirmar chegada, leitura e resposta. Registrar data, resultado e responsável no controle operacional privado. Nesta tarefa nenhum envio foi autorizado ou executado.
4. Exercitar o fluxo com uma solicitação fictícia até o encerramento e confirmar que a equipe consegue localizar seu registro e resposta.
5. Somente depois habilitar a página na configuração do ambiente:

   ```dotenv
   SKUE_CONTACT_EMAIL=contato@skue.tv
   SKUE_CONTACT_ENABLED=true
   ```

   Esses nomes e o endereço são configuração prevista, não credenciais. Não editar ou copiar arquivos de ambiente reais para o repositório. Se o ambiente usa cache de configuração, atualizar esse cache no procedimento de publicação aprovado.

6. Conferir a página pública e o link do app. O endereço precisa ser válido para que os botões apareçam; isso verifica formato, não entrega de e-mail.

Critério de conclusão operacional: caixa e responsável confirmados, teste real de recebimento/resposta aprovado e caso fictício concluído pelo responsável. Até lá, manter `SKUE_CONTACT_ENABLED=false` ou sem definição.
