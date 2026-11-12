# Análise das condições de lançamento do Skue

Data: 12/11/2026, America/Recife. Ferramenta: Codex.
Escopo: checkout e oferta pública, origem das listas, transporte de mídia, textos e aceite legais, notificações, beta web e evidências de distribuição.

## Conclusão

O projeto atende parcialmente à proposta de um software reprodutor de conteúdo escolhido pelo usuário, mas ainda não atende ao conjunto das condições para abertura comercial. Recomenda-se manter testes controlados até resolver as pendências abaixo. Esta conclusão é técnica e operacional; não equivale a parecer jurídico ou declaração de ilegalidade.

Nenhuma funcionalidade foi alterada ou desativada nesta análise. A pausa de assinatura pedida anteriormente foi preservada. Nenhum pagamento, reprodução externa ou consulta de dados reais de clientes foi realizado.

## 1. Cobrança pela licença do software — parcialmente atendido

Evidências favoráveis:

- A página inicial informa que o Skue não fornece conteúdo e exige lista própria (`backend/resources/views/welcome.blade.php:33`).
- Oferta e checkout usam a expressão licença. O produto Stripe é `Skue Player - Licença Anual (1 Ano)` (`backend/app/Http/Controllers/Api/PaymentController.php:24`).
- Não foi encontrada promessa de catálogo fornecido pelo Skue nos fluxos públicos examinados.

Pendências verificadas:

- O site anuncia anual por € 4,99 e vitalícia por € 9,99 (`welcome.blade.php:206`, `:226`). O checkout aceita apenas `yearly`, por 1.990 centavos de BRL, isto é, R$ 19,90 (`PaymentController.php:22-39`). Não há oferta comercial única e coerente entre página e pagamento.
- O rodapé diz que não vende “inscrições”, enquanto a interface utiliza licença/assinatura. Convém uniformizar a comunicação como licença de uso do software e explicitar que não inclui direitos sobre conteúdo.
- O modal de licença continua comentado em `web/src/App.vue:219`, conforme pausa de testes. Isso não autoriza reativá-lo nem comprova controle comercial de acesso.
- A página de sucesso afirma ativação concluída a partir da rota de retorno, sem consultar pagamento nessa rota (`backend/routes/web.php:37`; `backend/resources/views/portal/payment_success.blade.php:16`). Não usar a página como comprovante de pagamento.

Bloqueador técnico de cobrança:

- `PaymentController::handleWebhook` verifica assinatura somente quando segredo E cabeçalho estão presentes; sem cabeçalho, decodifica o JSON e processa o evento, mesmo com segredo configurado (`:117-121`).
- Em teste isolado, evento fictício sem assinatura, com `payment_status=unpaid` e valor de um centavo, criou assinatura e ativou dispositivo fictício. Banco SQLite em memória; nenhuma Stripe real foi chamada.
- Antes de cobrar: exigir assinatura válida, validar pagamento/plano/valor/moeda/dispositivo e garantir processamento idempotente por identificador do evento/sessão. A falta de verificação de assinatura é comprovada por teste; idempotência não foi testada nesta análise e não aparece no fluxo examinado.

## 2. Conteúdo escolhido pelo usuário — atendido no fluxo principal, com ressalvas

- O portal autentica MAC/chave e mantém sessão por dispositivo (`backend/app/Http/Controllers/PortalController.php:29`).
- `DevicePlaylistService` recebe URL/tipo/credenciais do usuário e cria ou altera playlists vinculadas ao dispositivo. Consultas e alterações usam a relação `$device->playlists()`, inclusive para buscar o ID solicitado (`backend/app/Services/DevicePlaylistService.php:13`).
- A configuração autenticada entrega somente listas ativas do dispositivo (`backend/app/Http/Controllers/Api/DeviceController.php:136`). Os testes existentes cobrem fluxos do portal e de dispositivo; não foi feita auditoria exaustiva de autorização de todos os endpoints.
- A home monta destaques e categorias com dados do banco local (`web/src/views/HomeView.vue:60`). TMDB complementa metadados por título/tipo; não é fonte de links de reprodução no fluxo examinado (`backend/app/Http/Controllers/Api/TMDBController.php:20`).
- Não foram encontrados catálogo compartilhado ou indicação de fornecedores nesses fluxos. Essa observação não certifica publicidade externa, parceiros, atendimento ou listas efetivamente utilizadas pelos clientes.

Ressalva de distribuição:

- `web/public/test.m3u` é público e respondeu HTTP 200 no Vite. Contém quatro entradas com nomes de canais/obras conhecidos, mas todas as quatro URLs de reprodução usam domínios reservados de exemplo. Não foi identificada lista real de reprodução nesse arquivo.
- Recomenda-se retirar a fixture da pasta pública e usar nomes fictícios nos testes, evitando distribuir qualquer material que possa parecer oferta de catálogo. Não remover sem autorização de implementação.

## 3. Reprodução diretamente da fonte — atendida pelo player; limite do backend incompleto

Fluxo observado:

1. Usuário cadastra a origem no portal; backend guarda configuração da playlist.
2. Dispositivo recebe suas playlists por API autenticada.
3. Lista M3U é buscada diretamente; se falhar, o store tenta o proxy (`web/src/stores/playlist.ts:301-334`). EPG usa o proxy (`web/src/services/epg.service.ts:54`).
4. Parser/banco local organizam os itens.
5. Reprodução usa a URL de origem: HTML5 recebe `video.src = url` (`VideoPlayer.vue:622`), HLS usa `loadSource(url)` (`:681`), MPEG-TS recebe `url` (`:733`) e o loader faz fetch da fonte (`web/src/lib/liveTsLoader.ts:109`).
6. Android recebe essa URL na bridge (`VideoPlayer.vue:850`) e cria `MediaItem.fromUri(...)` no aparelho (`MainActivity.java:282`).

Não foi encontrado encaminhamento normal do vídeo pelo Laravel nesses caminhos. Isso é evidência estática; não foi capturado tráfego de reprodução real nesta análise.

Lacuna importante:

- `/api/v1/proxy` aceita qualquer URL HTTP/HTTPS que passe pelo filtro de IP inicial, faz GET, lê o corpo inteiro e devolve o corpo ao cliente (`backend/routes/api.php:57-103`). Exige token de dispositivo e possui throttle; não é um proxy anônimo.
- Não há restrição a formato de playlist/EPG, rejeição de respostas de vídeo ou limite explícito de bytes no código da rota. Reescrever o Content-Type da resposta para texto não impede transporte de mídia.
- Teste com resposta HTTP simulada `video/mp2t` confirmou que um dispositivo fictício autenticado recebe o corpo integral pelo endpoint. Não houve vídeo real nem conexão externa.
- Esse comportamento permite usar o backend para transportar bytes de mídia, mesmo que a interface atual não o faça durante a reprodução. A evidência não demonstra retransmissão de vídeo em produção.

Correção proposta: substituir o fetch genérico por operações específicas de importação de playlist/EPG, com validação de formato, orçamento de bytes/tempo e validação de destinos/redirecionamentos. Manter vídeo direto no aparelho. Se uma origem não for compatível com navegador, informar a limitação e oferecer uso do app compatível, em vez de adicionar retransmissão geral ao servidor.

## 4. Canal de notificações e procedimento — parcialmente atendido

- Existe `contato@skue.tv` sob “Suporte / DMCA” em `web/src/views/SettingsView.vue:247`, exibido como texto.
- Não foi validada criação da caixa, entrega de mensagens, responsável ou operação do atendimento. Um texto com e-mail não comprova canal operacional.
- Não foram encontradas página pública específica, fila de casos, responsável, prazo interno, triagem, resposta e registro das providências no código/documentação examinados.
- A documentação histórica já registra a necessidade de processo; isso não é comprovação de implementação (`docs/ANALISE_MVP.md:243`).

Antes da abertura: publicar contato acessível também pelo site, testar recebimento e definir procedimento com responsável e registro mínimo de notificação, análise, resposta e providência. O processo deve distinguir aquilo que o Skue controla (contas, configuração, links e infraestrutura própria) de fontes externas que não pode remover. Prazos e critérios jurídicos precisam ser definidos com assessoria, não inventados pelo software.

## 5. Revisão jurídica e documentos — pendente de comprovação

- Os links Termos de Uso, Política de Privacidade e Aviso Legal apontam para `#` (`backend/resources/views/layouts/app.blade.php:176-178`); confirmado também no HTML servido localmente.
- Há modal de termos montado em `web/src/App.vue:217`, mas a versão é `1.0-draft` tanto no frontend quanto no backend.
- O frontend pede aceite somente quando não encontra valor salvo, sem exigir novo aceite por divergência da versão; registra aceite local mesmo quando o envio falha, sem verificar `response.ok` (`web/src/components/TermsModal.vue:25-70`). O backend recebe uma versão livre e só informa a versão corrente na resposta (`TermsController.php:19-35`).
- Não foi encontrada evidência de aprovação jurídica final no material examinado. Isso não permite afirmar que o usuário nunca tenha contratado revisão externa.

Transparência e credenciais:

- O modal descreve todo processamento/armazenamento de listas como local (`TermsModal.vue:124`) e as configurações fazem afirmação ampla de que nenhum conteúdo é transmitido pelos servidores (`SettingsView.vue:252`). É necessário esclarecer configuração sincronizada e busca de listas/EPG pelo servidor, separando-as do fluxo de vídeo.
- URL, usuário e senha da playlist são persistidos pelo backend. `DevicePlaylist::$hidden` oculta senha na serialização comum, mas não criptografa o banco; não há cast/mutator de criptografia no modelo examinado.
- Teste em banco em memória confirmou senha fictícia legível na coluna após passar por `DevicePlaylistService`. Isso comprova ausência de criptografia nessa camada da aplicação; não avalia criptografia do disco/infraestrutura.
- A configuração do dispositivo faz `makeVisible('password')` para entregar credenciais ao aparelho autenticado (`DeviceController.php:139`), funcionalmente necessário para essa arquitetura. Política e controles precisam refletir isso.
- Antes de lançar: definir documentos completos, identidade e contato do operador, finalidades/dados compartilhados/retenção/exclusão e proteção de credenciais; encaminhar modelo comercial e diagrama técnico para revisão jurídica brasileira. Criptografia deve ser planejada com migração e gestão de chaves, sem alteração improvisada de dados existentes.

Referências normativas consultadas, sem conclusão jurídica automática:

- [Código de Defesa do Consumidor](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm), arts. 30 e 31: relevância de oferta e informação clara para corrigir divergência comercial.
- [Marco Civil da Internet](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm), arts. 19, § 2º, e 31: tratamento específico de direitos autorais. Não pressupor imunidade por autodeclaração de neutralidade.
- O acesso direto ao texto da LGPD no Planalto retornou bloqueio nesta consulta; esta análise não certifica conformidade LGPD/GDPR nem apresenta interpretação jurídica definitiva.

## 6. Site/painel/apps primeiro e web em beta — ainda não implementado como política de lançamento

- O router Vue permite onboarding, configurações e pareamento, e exige lista carregada para as outras telas. Isso não é controle de convidados de beta (`web/src/router/index.ts:76`).
- Não foi encontrado controle específico de acesso por convite/allowlist ao player web nos fluxos examinados. Não foi auditada eventual proteção externa de hospedagem, ainda não comprovada.
- Um selo visual de beta ou esconder um link não restringe acesso. Proposta: proteger a publicação web de testes e/ou validar elegibilidade no backend, distinguindo esse acesso das versões instaladas. Não depender de flag apenas no JavaScript.
- Android tem projeto e bridge de reprodução presentes. Não foram encontrados projetos/pacotes específicos de Tizen e WebOS nas fontes rastreadas; isso não exclui material externo ao repositório. A declaração de suporte às plataformas deve corresponder a testes e distribuição reais.
- Site e portal locais responderam 200. Ambos os caminhos de download `/downloads/skue-tv.apk` e `/download/skue-tv.apk` responderam 200 a HEAD; portanto a diferença singular/plural no código não foi classificada como falha atual. Instalação e versão dos binários não foram verificadas.

## Prioridades propostas

1. Antes de qualquer cobrança: corrigir verificação Stripe e coerência entre oferta, planos e checkout; validar confirmação e idempotência sem pagamentos reais.
2. Antes de disponibilizar backend: limitar proxy ao propósito de listas/EPG e proteger configuração/credenciais.
3. Antes de abertura comercial: publicar documentos coerentes com o fluxo, comprovar revisão jurídica e canal operacional de notificações.
4. Antes de chamar a web de beta restrito: implementar controle real na publicação/backend, sem bloquear inadvertidamente apps.
5. Antes de anunciar cada plataforma: validar instalação, ativação e reprodução em dispositivos representativos. Preservar pausa de assinatura até orientação específica do usuário.

## Verificações executadas

- Inspeção de rotas, controllers, serviços, models, views, router, store, loaders e bridge Android; sem leitura de .env, logs de credenciais ou banco real de clientes.
- Backend: `./vendor/bin/phpunit --do-not-cache-result` — 41 testes, 276 asserções, aprovados, usando SQLite em memória conforme configuração da suíte.
- Frontend: `npm test` — 95 testes aprovados, um diagnóstico opcional pulado. Sem novo build ou instalação de APK.
- Três provas sintéticas em `/tmp/SkueLaunchAuditTest.php` — 3 testes e 7 asserções aprovados, confirmando comportamentos indesejados descritos: corpo de vídeo aceito pelo proxy, ativação por webhook sem assinatura, senha persistida legível. Foram executadas com `./vendor/bin/phpunit --configuration phpunit.xml /tmp/SkueLaunchAuditTest.php`. O primeiro comando emitiu aviso de permissão ao salvar cache do PHPUnit; os três testes concluíram com sucesso. Arquivo temporário não integrado à suíte do produto.
- HTTP local: homepage e portal 200; links legais `#` confirmados; fixture pública idêntica ao arquivo fonte; HEAD dos dois caminhos de APK 200, sem baixar binário.
- Git: alterações preexistentes preservadas; nenhuma correção funcional, deploy, DNS ou reativação comercial realizada.

Os testes existentes verdes comprovam seus cenários, não a ausência das lacunas encontradas. Revisão estática e fixtures não substituem validação de tráfego real, operação da caixa de e-mail, segurança integral ou aprovação jurídica.
