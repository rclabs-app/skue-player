# Investigação da regressão de reprodução ao vivo
Data/hora: 2026-11-09 21:39 (America/Recife)
Ferramenta: Codex
Estado: implementação e verificações locais concluídas; diagnóstico do Firefox pendente
Objetivo: investigar o travamento persistente comparando versões e exercitando o processamento real MPEG-TS.
Arquivos em uso: `web/src/components/VideoPlayer.vue`, `web/src/lib/continuousLiveLoader.ts`, testes do player/pipeline e `docs/ai/CONTEXT.md`.

## Evidência
- Usuário confirmou que a revisão anterior não resolveu; vídeo para após alguns segundos, sem erro no console da nova captura.
- O usuário informa que anteriormente funcionava. Histórico recente de `VideoPlayer.vue` foi consultado; as alterações em commits recentes são principalmente de retomada de VOD e histórico, enquanto o loader customizado e as mudanças privadas de timestamps são alterações locais recentes.
- Testes anteriores verificaram transporte e ciclo de vida com mídia simulada, sem exercitar o demuxer/remuxer real. Nesta revisão a reprodução real permanece sem acesso automatizado ao Firefox do usuário.

## Investigação e limites
- Os commits `b1cae69` e `67fd592` alteram principalmente histórico e retomada de VOD, que é ignorada com `isLive`; não foi comprovado que originaram o travamento.
- A configuração `liveBufferLatencyChasing` existia no início do projeto e foi retirada no commit `5c91638` (28/08). Essa diferença foi recuperada, sem atribuir a ela a causa do problema atual.
- Um diagnóstico temporário com o pipeline real mostrou que simplesmente concatenar respostas que reiniciam PTS/DTS pode quebrar a linha de tempo. A adaptação anterior evitou esse caso sintético, mas isso não confirmou o comportamento do canal do usuário. Não usar o teste como prova da causa real.
- O navegador continua inacessível pela ferramenta de automação (`browser access host is unavailable`); os processos do servidor e Firefox do usuário não estavam visíveis neste ambiente.

## Mudanças
- Restaurado o carregamento padrão do `mpegts.js`, com worker e correção de gaps de áudio, em `mpegtsConfig.ts`. Removidas as intervenções em campos privados do demuxer/remuxer e o loader experimental de reconexão.
- Removidos `continuousLiveLoader.ts` e seu teste, criados pelo Codex na revisão anterior e agora sem uso. Removido também o teste temporário de diagnóstico desta sessão.
- Mantidos o tratamento da Promise de play, a remoção de listeners/timers antigos e a liberação síncrona dos recursos antes de salvar o progresso.
- `livePlaybackMonitor.ts` distingue relógio congelado de quadros congelados, sem reiniciar a fonte e sem registrar credenciais/URLs. Loga posição, readyState, networkState, intervalos de buffer, quadros e velocidade após aproximadamente 6–8 segundos sem progresso. Não acusa pausa manual.
- Log explícito de término de entrada HTTP por `LOADING_COMPLETE`, sem pressupor que um read HTTP equivale ao final da transmissão.
- Mídia sintética H.264 com B frames e AAC, comprimida em `web/src/lib/__fixtures__/live-av-30s.ts.gz`, permite testar o processamento real sem credenciais e sem rede externa.
- Alterações visuais e pausa da assinatura preservadas.

## Verificações
- `npm --prefix web run test`: 5 arquivos, 17/17 testes aprovados.
- O teste de integração usa loader/demuxer/remuxer instalados e a configuração da aplicação para processar 30 segundos de mídia com reads incrementais. Verifica progressão, duração e continuidade de áudio/vídeo, e que o fim ocorre apenas quando a resposta HTTP termina. Não testa MediaSource, decodificação, worker real ou reprodução no navegador.
- `npm --prefix web run build`: tipagem e build concluídos sem erros.
- `git diff --check -- web/src/components/VideoPlayer.vue`: sem erros.

## Próximo passo necessário
Recarregar a página no Firefox e confirmar a mensagem `[Skue Live] Standard MPEG-TS pipeline active`. Se travar, coletar a mensagem `[Skue Live] Playback stalled` expandida e/ou `[Skue Live] Input ended`. Com esses dados será possível separar término de HTTP, falta de buffer e congelamento da decodificação. O problema real não foi declarado resolvido. Nenhum commit ou deploy foi feito.
