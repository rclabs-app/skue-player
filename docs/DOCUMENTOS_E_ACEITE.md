# Documentos e aceite no Skue

Estado em 12/11/2026: implementação para testes locais; minutas sem aprovação jurídica. Publicar páginas no código não significa deploy ou liberação comercial.

## Fonte e navegação

`backend/config/legal.php` reúne versão, estado e texto integral dos três documentos. As páginas públicas `/termos`, `/privacidade` e `/aviso-legal` usam essa fonte, assim como `GET /api/v1/app-version`, que entrega os textos ao modal do app. O rodapé aponta para as páginas e as configurações abrem um leitor sem solicitar outro aceite. Links do app usam o host Laravel definido para o portal.

Versão inicial: `2026-11-12-draft.1`. Alterações em qualquer texto exigem uma nova versão do conjunto. Não reutilizar uma versão para textos diferentes. Preservar no histórico Git a versão exata de cada publicação e o commit de liberação; o banco não armazena cópia integral do texto. Ao definir dados do responsável, ativar contato ou concluir mudanças do proxy, revisar os textos e incrementar a versão antes da publicação.

## Confirmação e persistência

1. Ao iniciar, voltar à aba ou receber o evento de conexão restabelecida, o modal consulta a versão atual sem cache HTTP. A identificação do dispositivo reutiliza a mesma resolução em andamento usada pela inicialização do app.
2. Sem confirmação local correspondente ao dispositivo, plataforma e versão, solicita leitura e ação explícita. A chave legada `skue_terms_accepted_version` não é prova de confirmação.
3. No clique, gera UUID da tentativa e o persiste localmente antes do envio; não utiliza dispositivo anônimo. `POST /api/v1/terms/accept` recebe UUID, identificador virtual do aparelho, plataforma e versão exibida.
4. O servidor valida a versão exata vigente, formato de dispositivo e plataforma. Persiste na tabela `terms_acceptances` versão, dispositivo declarado, plataforma, datas e UUID. Não grava IP nessa tabela; registros da infraestrutura dependem de configuração própria.
5. UUID é único no banco. Repetir a mesma tentativa devolve o comprovante original sem outro registro; reutilizá-lo com dados diferentes retorna 409. O servidor não transforma um aceite de versão antiga em aceite novo.
6. O app só fecha o modal e grava a confirmação após resposta HTTP bem-sucedida com identificador, dispositivo, plataforma e versão correspondentes e data válida. Erro HTTP, timeout, falha de rede ou corpo incompatível mantém a pendência. Ao tentar novamente, primeiro atualiza os textos; exige outro clique explícito para enviar.
7. Se a versão não mudou, o reenvio utiliza o mesmo UUID, inclusive após recarregar o app. Se mudou, exige leitura/ação para a nova versão e gera outra tentativa. Não há consentimento silencioso ou envio automático em segundo plano.

O endpoint permanece disponível antes do cadastro/ativação, com limite de requisições. O identificador do aparelho é declarado pelo cliente; o registro comprova o recebimento dessa declaração pelo servidor, não identidade civil, autoria incontestável ou autorização de conteúdo. O recibo local é cache de UX, não mecanismo de autenticação nem controle de acesso ao beta. O modal não impede as rotinas técnicas de inicialização/sincronização já existentes; o aceite de termos não é consentimento genérico para tratamento de dados. Essas limitações devem fazer parte da revisão jurídica do fluxo.

## Política offline

- Primeiro aceite ou versão já conhecida sem confirmação: modal permanece aberto; é necessária conexão para confirmar. Pode-se ler o texto previamente armazenado, quando existir.
- Aceite anteriormente confirmado da última versão conhecida para o mesmo dispositivo/plataforma: permite continuar offline. Não afirma que essa seja a versão mais recente do servidor.
- Ao reconectar ou voltar à aba, consulta novamente; se houver nova versão, exige novo aceite. Falha de conexão não revoga uma confirmação anterior da última versão conhecida.
- Não oferece aceite local provisório nem fila de aceites offline. Tentativa de envio com resposta perdida permanece com o mesmo UUID para repetição explícita.
- Limpar armazenamento local elimina o cache/recibo e pede nova confirmação online. Não apaga os registros históricos no servidor. O leitor das configurações pode ser fechado sem registrar novo aceite.

## Banco e implantação

A migration `2026_11_12_192000_add_acceptance_id_to_terms_acceptances.php` adiciona coluna nullable com índice único. Registros anteriores são preservados com UUID nulo, sem convertê-los em aceites da nova versão. O contrato novo exige UUID em novos pedidos; clientes antigos precisam atualizar e não recebem sucesso para versões antigas.

Aplicar a migration antes de distribuir o frontend novo, junto do backend compatível. Em instalação com mudanças preexistentes de credenciais ainda pendentes, não executar indiscriminadamente todas as migrations: planejar o conjunto conforme `OPERACAO_CREDENCIAIS.md`. Validar em banco de homologação e preparar backup conforme a operação do ambiente. A migration não converte configurações nem credenciais. Não foi autorizada publicação externa nesta tarefa.

## Pendências para abertura comercial

- Confirmar nome/razão social, documento quando aplicável e endereço do responsável; nenhuma identidade foi presumida.
- Criar o canal de contato e definir responsáveis/procedimento conforme `ATENDIMENTO_NOTIFICACOES.md`.
- Definir bases legais por finalidade, prazos de retenção/exclusão do aceite e demais dados, backups e logs.
- Inventariar fornecedores efetivamente contratados, locais de tratamento e eventuais transferências; não presumir hospedagem definida.
- Revisar descrição técnica após restringir o proxy e migrar credenciais legadas; revisar páginas e aceite com profissional brasileiro.
- Validar visualmente em desktop, mobile e aparelho, inclusive leitura, foco do controle remoto e retorno ao app após abrir link externo.

Referência legislativa consultada para a estrutura da minuta: [LGPD, texto atualizado da Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html), especialmente transparência sobre tratamento e direitos do titular. A referência não representa parecer sobre conformidade do produto.
