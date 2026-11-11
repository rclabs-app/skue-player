# Análise de Continuar Assistindo
Data/hora: 2026-11-10 20:56 (America/Recife)
Ferramenta: Codex
Estado: concluído; análise sem correção de produto
Objetivo: revisar gravação, listagem e retomada de progresso, sem alterar comportamento do produto.
Arquivos em uso: leitura de history.ts, VideoPlayer.vue, views de catálogo/detalhes, persistência local e testes; edição apenas deste registro e eventual teste diagnóstico temporário.
Verificações iniciais: árvore Git limpa; contexto e registros recentes consultados. Fluxo local no frontend identificado.
Pendências: validar cenários de séries, persistência e fechamento; executar testes existentes.


## Resultado verificado
- Fluxo: VideoPlayer emite progresso VOD (web a cada >3s, Android >5s e fechamento); history store normaliza valores, guarda posição e agrupa séries; SQLite salva history e exporta banco completo para OPFS/IndexedDB; Home/catálogos/Details consultam o store. Retomada a partir de 5s, conclusão em 95%; live não grava progresso novo.
- Problema alto: SettingsView.confirmSwapPlaylist chama loadPlaylistFromUrl; worker inicializa SQL.Database vazio e persiste sobre skue.db. reloadFromStorage substitui a instância principal. Não há migração do history anterior nessa importação. Atualizar a mesma lista perde o histórico persistido (e outras tabelas não reconstruídas). Constatação por rastreamento estático, sem tocar nos dados reais.
- Problema médio: loadHistory filtra episódios concluídos antes de deduplicar a série; updateProgress remove o cartão da série ao concluir o episódio atual. Cenário sintético confirmado: ep1 em 300/1000, ep2 em 960/1000; lista vazia antes de loadHistory e ep1 reaparece depois. Isso também deixa o cartão diferente da escolha de próximo episódio em Details.
- Identidade frágil: generateId do worker inclui índice da linha, além de URL e nome. Reordenar a lista muda IDs; preservar somente a tabela history não basta para corrigir a sincronização.
- Risco de desempenho por código: cada saveHistoryItem chama persist, que exporta o banco inteiro a cada atualização. Impacto em TV/listas grandes não medido nesta revisão.
- Testes existentes: 78 aprovados e 1 diagnóstico opcional ignorado. History tem quatro casos básicos; VideoPlayer.spec mocka getProgress sempre como null, portanto não comprova retomada de posição salva.
- Diagnóstico temporário: cópia isolada dos quatro testes de history com dois casos adicionais, seis aprovados. Um reproduz reaparecimento após conclusão; outro documenta inconsistência do store com atualização <5s de outro episódio (não tratado como defeito do fluxo atual, pois player normalmente não envia esse tick). Arquivo temporário removido após execução.
- Sem reprodução real em navegador/Android/TV, sem acesso a playlists privadas, sem alteração de código do produto, sem commits/push. Apenas este registro permanece.
- Próximo passo recomendado: preservar dados de uso na atualização de catálogo, estabilizar IDs e unificar seleção do episódio no carregamento/atualização; acrescentar testes de regressão e retomada real no player.
