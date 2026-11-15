# Consulta de episódios após recarregar
Data/hora: 2026-11-15 13:10 (America/Recife)
Ferramenta: Codex
Estado: correção publicada e regressão de cache validada; perfil real pendente
Objetivo: investigar relato de falha persistente após publicação e corrigir o fluxo comprovadamente afetado.
Arquivos previstos: web/src/stores/playlist.ts, playlistDownload.spec.ts; este registro e CONTEXT/docs de Xtream ao concluir. Sem APK, banco/contas de produção, pagamentos, EPG, commit ou push.
Leituras: contexto/README de contexto e registros recentes, GUIDELINES/README, diff/status, controller e store. Alterações anteriores preservadas.
Achado no código: initialize carrega catálogo local quando playlist_loaded=true, mas não preenche devicePlaylists. getSeriesEpisodes exige esse array em RAM para selecionar a rota autenticada; após recarregar, o array vazio faz cair na consulta direta sujeita ao CORS. O teste anterior usou importação nova e não cobriu reabertura com cache. Corrigir buscando configuração sob demanda antes da consulta autenticada, sem reimportar/apagar catálogo. Falha de atualização ou vínculo ausente não deve enviar consulta alternativa à fonte.
Consulta CLI Vercel de logs de requests iniciada, somente saída sanitizada; não inferir causa remota a partir de logs ainda não analisados.

Escopo adicional antes de editar: DetailsView.vue e seu teste para exibir somente status HTTP numérico de XtreamError conhecido, mantendo mensagens livres/privadas ocultas; isso permite distinguir eventual falha do servidor após corrigir o caminho com cache.

Alterações concluídas: getSeriesEpisodes recupera o vínculo via fetchDeviceConfig quando o catálogo reaberto não tem listas em RAM; se falhar ou não corresponder à configuração, informa erro e não tenta acesso direto. Catálogo salvo preservado; fluxo HTTP nativo mantido. DetailsView mostra apenas status HTTP de XtreamError conhecido, com teste que impede exposição de mensagens livres.

Verificações: 143 testes web aprovados/1 diagnóstico opcional pulado, build e diffcheck aprovados. Chromium isolado no domínio público com APIs/conta/catálogo fictícios, importação seguida de reload real e abertura de segunda série sem episódios em cache: vínculo inicialmente vazio, uma consulta de configuração/uma de episódios, vínculo restaurado e um episódio carregado, zero get_series_info direto/erros JS/pedidos inesperados. Nenhum dado real de produção modificado. Logs CLI request da nova rota no recorte retornaram somente401 do probe anônimo anterior; não afirmar exclusividade/cobertura total dos logs nem acesso real à fonte na Vercel.

Publicação web: dpl_A4QKCFJEqaCaef9eG5LTgRPiaVK1 READY, alias player.skue.tv. Artefato isolado atualizado somente com fontes do player. Backend anterior preservado, sem mudanças de conta/banco/env/DNS/plano/proteção/commit/push. APK hash243bcb4548c8f603d4a3f17349ef46b9ba58a392c34edd3f99f91abd2025f1f4 idêntico.

Pendência: usuário deve recarregar e consultar novamente no perfil real; eventual código HTTP distingue nova falha ao alcançar a rota. Não declarar reprodução resolvida nem solicitar limpeza de dados. Sem novo teste de fonte real nesta rodada.
