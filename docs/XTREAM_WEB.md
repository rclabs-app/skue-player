# Importação Xtream no player web

O portal continua armazenando a configuração fornecida pelo usuário. Na opção Conta Xtream, o player consulta diretamente `player_api.php` no servidor cadastrado. A importação M3U convencional permanece separada.

## Fluxo

1. `loadConfiguredPlaylist` é usado na inicialização, onboarding e troca de listas.
2. `XtreamClient` valida a conta e consulta categorias e itens de Live, VOD e séries.
3. O catálogo é convertido em um fluxo interno para o worker existente, em blocos. Nenhum fornecedor ou catálogo é pré-configurado.
4. O worker grava o catálogo no dispositivo, preservando histórico, favoritos e configurações. Uma falha antes da conclusão não publica o catálogo parcial.
5. Séries entram como metadados com contagem inicial zero. Para uma lista HTTPS ativa vinculada ao dispositivo autenticado, os episódios são consultados pela rota privada `GET /api/v1/devices/{mac}/playlists/{id}/xtream/series/{seriesId}`. O backend lê a configuração da própria lista e executa somente `get_series_info`; retorna os campos necessários dos episódios. Sem vínculo/token, permanece a consulta direta. Fontes HTTP no nativo continuam diretas. Os episódios ficam armazenados localmente.
6. Na reimportação da mesma conta, episódios já consultados são preservados apenas para séries ainda presentes no novo catálogo. Identidades usam URL/nome; alterações nesses valores podem impedir a associação de registros antigos, embora o histórico não seja apagado.

O catálogo é consultado diretamente na fonte. Na consulta autenticada de episódios, o navegador envia somente os identificadores do dispositivo, lista e série; o backend usa as credenciais já armazenadas pelo portal. A rota exige propriedade e lista ativa Xtream, segue no máximo dois redirecionamentos na mesma origem HTTPS, valida e fixa o endereço público via cURL e limita a resposta a 2 MiB. Só os campos necessários dos episódios são retornados, sem cache público. Recusas 401/403/451 são preservadas e interrompem a consulta. Respostas livres e mensagens de exceção não são expostas. O backend não retransmite mídia.

## Configuração e requisitos

No portal, selecionar Conta Xtream e informar a base HTTP/HTTPS correta do servidor e usuário/senha nos campos separados. Não acrescentar `get.php`, credenciais na URL ou uma porta presumida.

No navegador HTTPS, os endpoints de catálogo precisam oferecer HTTPS e permitir CORS para o player; episódios vinculados à lista autenticada usam a rota de metadados acima. Uma API HTTP é recusada com mensagem específica; o protocolo não é reescrito automaticamente. Falhas e recusas, inclusive 451, não disparam mudança de host, protocolo, região ou fallback para M3U/proxy genérico.

Autenticação com sucesso não comprova acesso a todos os endpoints do catálogo. Importar o catálogo também não comprova reprodução: cada fonte de mídia precisa ser acessível pelo navegador, com transporte/CORS/codec compatíveis. Não se alteram proteções do navegador ou certificados para forçar funcionamento.

## Escopo

Sem EPG, pagamentos ou alterações no APK. O APK publicado continua na versão anterior até a validação do navegador e nova orientação de atualização. Links SSIPTV que indexam sublistas não são expandidos por esta implementação.

## Verificação

Testes unitários cobrem autenticação, erros de formato, categorias/itens, geração de URLs, episódios sob demanda e interrupção em451 sem tentativas alternativas. Teste do worker verifica preservação de dados de uso e de episódios somente das séries mantidas.

Chromium isolado com API fictícia: importação completa, ausência de `get.php`, episódios sob demanda, histórico/favoritos/cache preservados e catálogo anterior intacto após falha parcial; nenhum erro JavaScript observado. A suíte teve 135 testes aprovados e um diagnóstico opcional pulado, com build aprovado.

Publicação web: `dpl_GjXCU2YweNpyhmdwvHgHCfwAoqS2` READY em `player.skue.tv`. Chromium também validou o bundle público com APIs fictícias: catálogo carregado, uma série/um episódio, oito chamadas API, zero `get.php` e zero erros JavaScript.

Após autorização específica do usuário (que resolveu a rejeição automática anterior), o bundle público foi testado com a fonte real. Cadastro/configuração de dispositivo no backend foram interceptados localmente, sem alterar contas/dispositivos. As sete chamadas de autenticação/categorias/catálogo retornaram 200 e o índice local carregou 5.805 séries, sem `get.php`. Isso comprova a importação real dessa configuração.

A validação completa ainda não passou:

- Consulta de episódios observada: redirecionamento 301 do endpoint principal para `info_api.php` na mesma origem HTTPS, sem CORS no redirecionamento. O endpoint indicado respondeu 200 também sem permissão CORS, impedindo leitura pelo navegador.
- Reprodução curta no VideoPlayer público: o vídeo não avançou. Solicitações HTTPS levaram a tentativas HTTP em outro host. Uma amostra TS respondeu 302 anunciando esse destino HTTP; uma amostra HLS respondeu 405. Não foram seguidos destinos HTTP no teste de cabeçalhos nem reescritos URLs para forçar acesso.
- Os resultados são de uma série e um canal; não representam todos os itens. A fonte precisa oferecer CORS para as respostas de episódios e um caminho de mídia HTTPS compatível com o navegador. Importação aprovada não equivale a reprodução aprovada.

O APK permanece sem atualização. Nenhuma credencial, nome de item, catálogo ou URL privada foi incluída nesta documentação; perfis de navegador usados nos testes foram temporários e encerrados.

## Correção de episódios e diagnóstico em 15/11, após 12:50

A consulta limitada de metadados substitui a dependência de CORS da fonte para os episódios de listas HTTPS autenticadas. Teste real do novo controller em Laravel com banco exclusivamente em memória: redirecionamento 301 na mesma origem HTTPS seguido de JSON 200, com 94 episódios retornados. Nenhuma conta/dispositivo/lista de produção foi alterada. Isso não comprova a consulta autenticada real executada na Vercel, que depende de validação no perfil do usuário.

DetailsView impede abrir reprodução sem episódio carregado, mostra falha de consulta e oferece nova tentativa. O player distingue erro de rede nativo de tentativas de formato; a mensagem final não afirma incompatibilidade de codec sem evidência. Séries usam identificação própria na barra do player. A página inicial encaminha filmes e séries à mesma DetailsView usada nas seções correspondentes.

Verificação atual: 140 testes web aprovados, um diagnóstico opcional pulado, build aprovado; 90 testes Laravel/638 asserções aprovados com APP_ENV=testing e SQLite em memória. A primeira execução herdou APP_ENV=local do Docker e teve falhas 419 de CSRF; a repetição com ambiente de testes explícito passou. Testes novos cobrem autenticação/propriedade, redirecionamento permitido e recusado, limite de tamanho, bloqueio de IP privado, interrupção em 451, carregamento/retry e preservação de consulta HTTP nativa.

Backend publicado: dpl_GG7JFyPJAWjPGvytD2en6SNsL25h READY. Primeiro bundle web desta correção: dpl_6EgKFKUY41PaiXfNQRVz7kspVmqi READY. Chromium isolado no domínio público, com conta e catálogo fictícios interceptados: uma consulta à nova rota de episódios, um episódio carregado, nenhuma consulta direta get_series_info, zero erros JS e zero pedidos externos inesperados. Site/saúde 200 e rota de episódios anônima 401.

As falhas de vídeo exibidas nas capturas continuam sendo uma pendência distinta: redirecionamento da mídia para HTTP bloqueado pelo navegador HTTPS. Não foi adicionado proxy de vídeo ou reescrita de protocolo/destino. Não considerar reprodução de filmes, séries ou Live validada por estes testes de metadados. APK permanece idêntico.

Publicação final do ajuste para preservar fontes HTTP nativas: dpl_Gbin5UMgJPK1iiNeMZNvqaXmJuTf READY em player.skue.tv. O mesmo teste Chromium com catálogo fictício passou no bundle final.

## Correção de reabertura com catálogo em cache

Após relato de falha persistente, foi identificado que o catálogo local era reaberto sem restaurar o array em memória de listas do dispositivo. A consulta de episódios acabava selecionando transporte direto. Agora o vínculo autenticado é atualizado sob demanda antes da consulta, sem reimportar ou apagar dados. Uma falha nessa atualização não dispara consulta alternativa à fonte. Erros conhecidos exibem apenas o código HTTP, sem mensagens livres.

Player dpl_A4QKCFJEqaCaef9eG5LTgRPiaVK1 READY; 143 testes web aprovados, um opcional pulado, build aprovado. Chromium com dados fictícios no domínio público: catálogo importado, página recarregada, vínculo vazio confirmado antes da consulta de uma segunda série sem episódios em cache; uma busca de configuração e uma de episódios, vínculo restaurado/episódio carregado, nenhuma consulta direta, zero erros JS. Validação com fonte real a partir da Vercel e reprodução permanecem pendentes. APK preservado.
