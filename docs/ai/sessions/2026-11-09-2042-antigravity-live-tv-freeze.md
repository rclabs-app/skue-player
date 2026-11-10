# Correção de travamento da Live TV após ~10 segundos
Data/hora: 2026-11-09 20:42 (America/Recife)
Ferramenta: Antigravity
Estado: concluído
Objetivo: Corrigir a interrupção da reprodução de canais ao vivo (Live TV) que trava após ~10 segundos no navegador (`MediaSource onSourceEnded` ao encerrar o primeiro segmento/chunk HTTP MPEG-TS).
Arquivos em uso:
- `web/src/components/VideoPlayer.vue`
Mudanças e decisões:
- Identificado via console do navegador que o `FetchStreamLoader` padrão do `mpegts.js` interpreta o término do chunk HTTP de ~10s (`result.done === true`, sem `Content-Length`) como `LoaderStatus.kComplete`, disparando `LOADING_COMPLETE` e `MediaSource.endOfStream()`.
- Implementado loader contínuo customizado (`createContinuousLiveLoader` / `ContinuousLiveFetchLoader`) para streams ao vivo (`isLiveStream === true`) no `mpegts.js`, mantendo o `MediaSource` aberto sem emitir `onComplete`, alinhando chunks em pacotes MPEG-TS de 188 bytes (`0x47`), descartando bytes parciais de final de conexão, evitando duplicação de segmentos via assinatura FNV-1a (`computeTsChunkSignature`) e reconectando automaticamente quando o buffer restante cai para `<= 2.8s`.
- Adicionados `flushLiveTransmuxerSegmentEnd` e `installLiveRemuxerGuard` em `web/src/components/VideoPlayer.vue` para emitir o último pacote PES de vídeo ao fim de cada conexão e reajustar `_dtsBase`, `_videoNextDts` e `_audioNextDts` entre reconexões ou descontinuidades de PTS/DTS.
- Habilitados `autoCleanupSourceBuffer: isLiveStream`, `autoCleanupMaxBackwardDuration: 60` e `autoCleanupMinBackwardDuration: 30` na configuração do `mpegts.createPlayer`.
Verificações executadas e resultados:
- `npm --prefix web run test` (Vitest): 2 arquivos de teste, 8/8 testes aprovados.
- `npm --prefix web run build` (`vue-tsc -b && vite build`): tipagem TypeScript e build de produção concluídos sem erros.
- Hot reload (HMR) aplicado no servidor Vite em execução (`http://localhost:5173`).
Pendências e próximo passo:
- Aguardar validação prática do usuário na reprodução contínua dos canais Live TV no navegador.
