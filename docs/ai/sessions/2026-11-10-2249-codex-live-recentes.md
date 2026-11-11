# Live TV: vistos recentemente
Data/hora: 2026-11-10 22:49 (America/Recife)
Ferramenta: Codex
Estado: concluído; validação visual pendente
Objetivo: substituir Continuar Assistindo por Vistos recentemente no Live, com histórico de canais sem retomada de posição.
Arquivos previstos: history store/testes, VideoPlayer/testes, LiveView, playlist (limpeza), testes de catálogo, contexto e este registro.
Verificações iniciais: árvore limpa; contexto e último registro consultados. Live filtrava activelyWatching, que exclui canais ao vivo. Player não grava progresso live.
Decisão: registrar canal uma vez quando a reprodução começar, mantendo filmes/séries separados. Reutilizar tabela local history e migração já existente.

Resultado: LiveView usa RECENT/Vistos recentemente. Player registra uma visita ao receber playing (web) ou renderingStart (nativo), sem gravar posição live. Store mantém lista separada, ordenada e sem duplicatas, persistida na tabela history; carregamento resolve somente canais presentes no catálogo. Remoção administrativa limpa também lista recente em memória. Testes cobrem início efetivo, deduplicação, ordem, recarga e separação de VOD. 94 testes aprovados, 1 diagnóstico opcional ignorado; build e diff check aprovados. Sem validação em aparelho real, APK, commits ou push. Push anterior continua sem confirmação específica do destino.
