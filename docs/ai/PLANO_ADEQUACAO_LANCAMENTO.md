# Plano de adequação do Skue

Data: 12/11/2026. Estado: etapa 1 implementada, com validação visual pendente; EPG removido; etapa 3 implementada e testada em base sintética, com aplicação operacional pendente; etapa 4 preparada tecnicamente, com operação pendente; etapa 5 implementada para testes locais, com minutas e revisão pendentes; restrição do proxy na etapa 2 e etapas 6 e 7 planejadas.
Base: análise local em `ANALISE_LANCAMENTO_2026-11-12.md` e orientações atuais do usuário.

## Decisões e limites

- Não haverá plano vitalício nem promessa de acesso ou manutenção para sempre.
- Integrações, endpoints, webhooks, testes e correções de pagamentos ficam fora deste plano. Nenhum provedor será escolhido ou configurado.
- A análise anterior permanece como registro histórico; sua ordem de prioridades não substitui o escopo atual.
- Preservar a pausa de assinatura durante os testes. Não reativar bloqueios comerciais.
- Priorizar site institucional/portal, administrativo e apps. Preparar acesso restrito à versão web como proposta de lançamento, sem desligar funcionalidades nesta etapa de planejamento.
- Não presumir preços, novos planos, publicação pronta ou aprovação jurídica.

## Etapa 1 — Ajustar a apresentação do produto

Estado em 12/11/2026: implementação aplicada. Oferta e rótulo vitalícios removidos; site informa Android/Web em testes e Tizen/WebOS planejados; descrição de licença e fontes próprias revisada; fixture movida para `web/src/lib/__fixtures__/sample-playlist.m3u` com nomes fictícios. Preços restantes e regras de assinatura preservados.

Verificação: builds web/backend aprovados; oito testes do portal/87 asserções aprovados; HTTP 200 no site, CSS e portal; antiga fixture pública retorna 404 e não integra o build web. Layout utiliza uma coluna em mobile e duas a partir de md na seção de licenças. Inspeção visual real em desktop/mobile pendente: ferramenta de navegador indisponível. Registro: `sessions/2026-11-12-1432-codex-etapa1-apresentacao.md`.

Entrega:

- Retirar do site a oferta vitalícia e expressões equivalentes de compromisso permanente, ajustando o layout para as opções restantes.
- Uniformizar a apresentação como software reprodutor: conteúdo e fontes fornecidos pelo usuário; licença não inclui canais ou catálogo.
- Revisar promessas de suporte às plataformas, distinguindo disponível, em teste e planejado.
- Retirar `web/public/test.m3u` da distribuição pública; manter exemplos fictícios apenas como fixtures de teste quando necessários.
- Não definir novos preços nem alterar integração de cobrança.

Arquivos previstos: `backend/resources/views/welcome.blade.php`, `backend/resources/views/layouts/app.blade.php`, `web/public/test.m3u` e fixtures pertinentes. Conferir referências antes de mover o arquivo.

Concluída quando: página sem oferta vitalícia, comunicação coerente, navegação para o portal preservada e arquivo de teste ausente dos assets públicos distribuídos. Verificar visualmente desktop/mobile e conferir o build que efetivamente será distribuído.

## Etapa 2 — Limitar o backend à importação de listas

Escopo atualizado: EPG removido do produto por decisão do usuário em 12/11/2026. Esta etapa passa a tratar apenas a importação de listas. A restrição do proxy ainda não foi implementada.

Riscos de compatibilidade a validar antes da restrição:

- Listas que falham no acesso direto por CORS ou por origem HTTP em página HTTPS dependem do fallback pelo backend. Remover o proxy sem substituição pode impedir novas importações e atualizações dessas listas.
- URLs Xtream e links com parâmetros podem entregar M3U sem extensão no caminho. Não exigir extensão `.m3u`; validar o conteúdo retornado.
- Autenticação na URL, redirecionamentos e respostas compactadas precisam continuar funcionando dentro dos limites de segurança. Validar cada destino sem tratar todo redirecionamento legítimo como erro.
- Limites de bytes/tempo e validação de formato podem rejeitar listas grandes ou malformadas que hoje passam. Definir limites explícitos e mensagens úteis, cobrindo CRLF/BOM, M3U estendido e respostas sem Content-Type confiável.
- Preservar troca de lista principal, IDs do conteúdo e dados de uso. A reprodução atual usa diretamente a origem, mas depende de a lista ter sido importada corretamente.

Remoção de programação aplicada em 12/11/2026: serviço, worker, tela de guia, rota, auto-sync, consultas/banners e APIs de armazenamento retirados. Migração do SQLite elimina somente a tabela/configuração antiga de programação e preserva `tvg-id` como identificador de canal. Testes com banco antigo, importação via worker e navegação aprovados. Nomes legados permanecem apenas em migrações/testes e documentos históricos; não representam funcionalidade disponível. Registro: `sessions/2026-11-12-1523-codex-remover-epg.md`.

Entrega:

- Substituir o fetch genérico por operações específicas de importação de playlists, preservando autenticação e limites de requisição.
- Validar o formato real da resposta, não apenas extensão ou Content-Type declarado; rejeitar mídia binária e conteúdo fora do propósito.
- Definir limites de tamanho, duração, descompressão e redirecionamentos, com controle de bytes durante a leitura.
- Validar destinos e redirecionamentos para impedir acesso a redes internas.
- Adaptar a importação no frontend; informar incompatibilidades de origem sem criar retransmissão de vídeo.
- Manter HTML5, HLS, MPEG-TS e Android reproduzindo diretamente da fonte no dispositivo.

Arquivos previstos: `backend/routes/api.php`, controller/serviço específico a criar, `web/src/stores/playlist.ts` e testes associados. Usar `VideoPlayer.vue` e a bridge Android como pontos de verificação; editar somente se necessário.

Concluída quando: testes com fontes sintéticas aceitam listas válidos, rejeitam vídeo e respostas inválidas e interrompem downloads grandes/descompressões excessivas. Validar também redirecionamentos e destinos internos; confirmar reprodução direta em captura controlada de rede. Não acessar fontes reais de clientes para testar.

## Etapa 3 — Proteger configurações e credenciais

Estado em 12/11/2026: proteção implementada para novas gravações de URL/usuário/senha de playlists e payloads temporários de pareamento. Leitura legada preservada para transição. Comandos de inspeção, conversão e recuperação com backup criptografado implementados; nenhuma transformação da base em uso executada nesta tarefa. Procedimento e inventário em `../OPERACAO_CREDENCIAIS.md`.

Validação: 58 testes de backend/394 asserções e 98 testes frontend aprovados, um diagnóstico opcional pulado; build web aprovado. Cenários de migração/recuperação em SQLite em memória, chave incorreta/anterior, arquivo adulterado, falha de backup, campos máximos, isolamento, exclusão e pareamento de uso único verificados. Conversão real, homologação no banco de destino, validação visual/dispositivo, retenção operacional de backups/logs e aprovação de gestão das chaves continuam pendentes.

Entrega:

- Mapear URL, parâmetros sensíveis, usuário e senha ao longo do portal, API, banco, logs e respostas.
- Planejar criptografia na aplicação para campos sensíveis, incluindo credenciais que possam estar embutidas na URL.
- Criar migração segura dos registros existentes: backup protegido, transformação controlada, verificação e estratégia de recuperação. Não imprimir valores nos logs nem usar banco real em testes automatizados.
- Definir gestão e recuperação das chaves antes de migrar; não tratar apenas ocultação em JSON como criptografia.
- Garantir isolamento por dispositivo e entrega de credenciais somente ao fluxo autenticado que precisa delas.
- Verificar exclusão e retenção de configuração, distinguindo banco ativo, logs e backups.

Arquivos previstos: `backend/app/Models/DevicePlaylist.php`, `backend/app/Services/DevicePlaylistService.php`, controllers do portal e de dispositivos, migration/comando de migração a definir e testes. Modelos e migrations relacionados serão conferidos antes da implementação.

Concluída quando: valores sintéticos não aparecem em claro nas colunas protegidas, aparelho autorizado continua sincronizando, outro dispositivo não acessa a configuração e uma base de teste anterior à migração é convertida sem perder acesso. Estratégia de recuperação documentada e verificada em ambiente isolado.

Dependência atualizada: a pedido do usuário, proteção aplicada ao fluxo atual antes da restrição do proxy da etapa 2. Revalidar inventário e erros quando essa restrição for implementada. Aplicação em instalação existente exige conferir chaves, backup integral e manutenção conforme o procedimento; não usar rollback de colunas para recuperar credenciais.

## Etapa 4 — Organizar o atendimento a notificações

Estado em 12/11/2026: página pública `/contato` implementada, com links no rodapé institucional e nas configurações do app. Usuário informou que a caixa ainda não existe; responsável não identificado. Canal desativado por padrão, exibindo “Canal em preparação” sem endereço ou botões de envio. Ativação futura por configuração exige endereço válido. Procedimento de triagem, encaminhamento, decisão, resposta e registro em `../ATENDIMENTO_NOTIFICACOES.md`.

Validação técnica: 61 testes backend/412 asserções e 101 testes frontend aprovados, um diagnóstico opcional pulado; builds backend/web aprovados. Site e contato retornaram HTTP 200, com link e estado desativado conferidos no HTML. Inspeção visual indisponível. Operação pendente: criar caixa, designar responsável, definir acompanhamento/prazos/retenção e testar recebimento/resposta e caso fictício pela caixa real. Nenhuma mensagem enviada; exercício documental não comprova operação.

Entrega:

- Definir responsável e confirmar o endereço institucional de atendimento com o usuário.
- Disponibilizar contato acessível pelo site e pelo app; testar recebimento e resposta com uma mensagem de teste autorizada.
- Documentar recebimento, identificação do pedido, triagem, encaminhamento jurídico, decisão, resposta e registro mínimo das providências.
- Definir prazos internos e retenção com o responsável e assessoria; não inventar prazo legal.
- Distinguir recursos controlados pelo Skue de conteúdo hospedado por terceiros. Não prometer remover conteúdo da origem externa.
- Começar com processo simples documentado e caixa acompanhada; não exigir um sistema de tickets novo para concluir a etapa.

Arquivos previstos: layout e página de contato no Laravel, rotas correspondentes, `web/src/views/SettingsView.vue` e procedimento operacional próprio em `docs/`.

Concluída quando: contato aparece nos dois produtos, mensagem de teste chega ao responsável e um caso fictício percorre o procedimento até a resposta. Criação da caixa/serviço depende de acesso ao provedor; exibir um e-mail sozinho não conclui a etapa.

Pode ser iniciada em paralelo às etapas 2 e 3, sem significar autorização para enviar mensagens nesta tarefa.

## Etapa 5 — Publicar documentos e tornar o aceite verificável

Estado em 12/11/2026: minutas acessíveis em `/termos`, `/privacidade` e `/aviso-legal`; links institucionais reais e leitor no app. Texto integral e versão única `2026-11-12-draft.1` em `backend/config/legal.php`, fornecidos ao app pela API. Servidor valida versão vigente e registra tentativa por UUID único; app só confirma após recibo correspondente. Falhas mantêm tentativa para reenvio explícito sem duplicação. Confirmação anterior permite uso offline da última versão conhecida; primeiro aceite exige conexão. Identificação do dispositivo é declarada, não prova de identidade civil. Procedimento: `../DOCUMENTOS_E_ACEITE.md`.

Validação: 67 testes backend/502 asserções e 117 testes frontend aprovados, um diagnóstico opcional pulado; builds backend/web aprovados. HTTP 200 no site, três páginas e versão da API com conteúdo conferido. Migration exclusiva do UUID aplicada no ambiente local; migration de credenciais permanece pendente. Inspeção visual/dispositivo indisponível ou não executada; nenhum deploy ou novo APK. Testes de aceite usam banco isolado, sem inserir aceites fictícios no banco em uso.

Pendências para fechar a etapa: dados públicos do responsável solicitados ao usuário e ainda não confirmados; bases legais/finalidades, retenção, fornecedores/localização de tratamento e contato operacional precisam de definição e revisão jurídica. Textos descrevem limitações atuais, inclusive proxy ainda não restrito e conversão de credenciais legadas pendente; revisar e incrementar versão após concluir essas operações. Não há aprovação jurídica ou liberação comercial implícita.

Entrega:

- Preparar termos, política de privacidade e aviso legal coerentes com as etapas 2 e 3: configuração sincronizada, listas buscados pelo servidor, vídeo direto e dados locais.
- Informar operador, contatos, finalidades, terceiros envolvidos, retenção e exclusão; validar os dados com o usuário.
- Substituir os links `#` por páginas reais e acessíveis. Identificar as minutas antes da revisão profissional.
- Centralizar a versão dos termos, solicitar novo aceite quando a versão exigida mudar e validar essa versão no servidor.
- Tratar envio malsucedido sem apresentá-lo como aceite confirmado pelo backend; definir política offline e eventual reenvio sem duplicação.
- Preservar um registro mínimo e proporcional de versão, dispositivo, plataforma e data; não coletar dados adicionais sem justificativa.

Arquivos previstos: `backend/resources/views/layouts/app.blade.php`, páginas legais a criar, `backend/routes/web.php`, `backend/app/Http/Controllers/Api/TermsController.php`, `backend/app/Models/TermsAcceptance.php`, `web/src/components/TermsModal.vue` e `web/src/views/SettingsView.vue`.

Concluída quando: links funcionam; textos refletem o fluxo final; testes cobrem mudança de versão, aceite corrente, versão inválida, falha do servidor, modo offline e reenvio. A conclusão técnica não substitui a revisão jurídica da etapa 7.

Dependências: etapas 2 e 3 para os textos finais; contato da etapa 4.

## Etapa 6 — Separar o beta web da distribuição dos apps

Entrega:

- Definir com o usuário quem participa do beta e como terá acesso.
- Escolher proteção da publicação web por autenticação/convite no servidor ou infraestrutura, mantendo o player fora de acesso público irrestrito.
- Não confiar em selo visual, link escondido ou flag JavaScript como controle de acesso.
- Separar esse controle do fluxo dos apps instalados; não presumir que um cabeçalho de plataforma enviado pelo cliente seja prova suficiente.
- Definir URLs de site, portal, administrativo, API e player de teste e configurar os builds conforme cada destino aprovado.
- Preservar o repositório único; aplicações podem ter publicações independentes. Infraestrutura será escolhida antes de implementar configurações específicas de hospedagem.

Arquivos previstos: configuração de deploy/autorização a definir; `web/src/router/index.ts`, helpers de API/portal e middlewares/rotas somente conforme a solução escolhida. Não editar ambientes reais ou publicar nesta fase de planejamento.

Concluída quando: participante autorizado entra no beta, visitante sem autorização não acessa a publicação protegida, e os apps continuam ativando/sincronizando. Revogação do beta deve impedir novos acessos online; limites de conteúdo já baixado/offline precisam ser explicitados.

Dependências: etapas 2 e 3 e definição do ambiente de publicação.

## Etapa 7 — Validar o conjunto e preparar a liberação por plataforma

Entrega:

- Executar testes de backend/frontend e builds pertinentes às mudanças; inspecionar o site e os fluxos em navegador.
- Validar apresentação → login MAC/chave → cadastro de lista → sincronização → reprodução e rotinas administrativas, com fontes autorizadas de teste.
- Testar instalação e uso em Android representativo. Para Tizen/WebOS, primeiro verificar ou implementar pacote e integração específicos; não anunciar distribuição pronta sem essa evidência.
- Entregar ao advogado brasileiro o fluxo técnico final, minutas, apresentação do produto e procedimento de notificações; incorporar os ajustes aprovados.
- Registrar separadamente: testes automatizados, validação real por plataforma, operação de atendimento e revisão jurídica. Usar isso para decidir quais superfícies podem ser liberadas primeiro.

Concluída quando: cada plataforma candidata tem evidência própria de instalação/ativação/reprodução, as correções deste escopo passaram nas verificações, o atendimento funciona e a revisão jurídica foi documentada. Plataforma ainda não validada permanece fora da lista de disponibilidade confirmada.

Dependências: etapas anteriores. A revisão jurídica pode começar antes, mas precisa considerar o fluxo final. A liberação continua sujeita a decisão específica de publicação; este plano não executa deploy.

## Ordem de trabalho

1. Etapa 1: retirar compromisso vitalício e corrigir apresentação.
2. Etapa 2: restringir importação/proxy de listas.
3. Etapa 3: proteger e migrar configurações.
4. Etapa 4 pode avançar enquanto 2 e 3 são executadas.
5. Etapa 5: fechar documentos e aceite com o fluxo consolidado.
6. Etapa 6: preparar beta web com acesso restrito.
7. Etapa 7: validação final, revisão jurídica e decisão de liberação por plataforma.

Cada etapa deve começar com revisão dos arquivos/diffs atuais e terminar com registro das verificações realmente executadas. Não há autorização implícita para commits, push, envio de e-mails ou publicação.
