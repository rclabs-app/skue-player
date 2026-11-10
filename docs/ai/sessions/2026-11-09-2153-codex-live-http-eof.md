# Tratamento de fim HTTP confirmado no Firefox
Data/hora: 2026-11-09 21:53 (America/Recife)
Ferramenta: Codex
Estado: implementação e verificações locais concluídas; teste com o canal real pendente
Objetivo: recuperar canais cuja resposta MPEG-TS termina, sem confundir fim HTTP com fim definitivo do canal.
Arquivos em uso: `web/src/components/VideoPlayer.vue`, testes do componente, helper de URLs live e testes em `web/src/lib/`, `docs/ai/CONTEXT.md`.

## Evidência nova
- Captura do usuário confirma versão atual e sequência `Input ended` → `MediaSource onSourceEnded` → `Media ended unexpectedly`.
- A biblioteca instalada chama `endOfStream()` antes de notificar `LOADING_COMPLETE`; tentar continuar o mesmo MediaSource após esse evento não é uma estratégia segura.
- Estratégia: manter processamento padrão; tentar a alternativa HLS no mesmo servidor para URLs com formato de canal Xtream quando TS termina, com fallback ao original se indisponível. Para fontes sem HLS, reabrir a sessão TS ao consumir o buffer, com limite para encerramentos sem progresso e cancelamento ao fechar/trocar canal.
- Nenhuma URL privada ou credencial será adicionada aos registros.

## Implementação
- `liveStreamUrl.ts` constrói candidato HLS apenas para caminhos convencionais de canal numérico (com ou sem prefixo `/live/` e extensão `.ts`), mantendo origem, porta, credenciais e query. URLs genéricas, VOD e HLS existentes não são convertidas.
- Em `LOADING_COMPLETE`, o componente registra a fonte original e, quando aplicável, agenda uma tentativa HLS fora do callback da biblioteca. HLS recebe seus próprios segmentos e timestamps; não reutiliza o MediaSource finalizado do MPEG-TS.
- Quando HLS falha, volta à fonte TS original sem repetir indefinidamente a tentativa HLS nessa sessão de canal.
- Sem alternativa HLS, o vídeo pode consumir o buffer já carregado. No evento `ended`, reabre automaticamente o player padrão com a fonte original. Três encerramentos sem reprodução útil encerram as tentativas com mensagem; respostas que reproduziram pelo menos três segundos renovam esse limite.
- A intenção de pausa é preservada ao trocar a fonte. Se o buffer terminar durante uma pausa, só reconecta quando o usuário pedir play. Timers e callbacks antigos são cancelados/ignorados ao fechar ou trocar de canal.
- Os callbacks HLS passaram a verificar a instância e geração ativas; handlers são registrados antes de carregar a fonte.
- Mantidos os testes existentes do processamento real da biblioteca e o diagnóstico numérico sem URLs.

## Verificação
- `npm --prefix web run test -- --silent`: 6 arquivos, 32/32 testes aprovados.
- `npm --prefix web run build`: TypeScript e build Vite aprovados.
- `git diff --check -- web/src/components/VideoPlayer.vue`: sem erros.
- Regressões novas: transformação restrita de URL, EOF/ended com transição HLS, fallback ao TS original, reconexão após consumir o buffer, limite sem progresso, renovação após playback, troca de canal, fechamento, VOD inalterado e pausa preservada (incluindo play após EOF).
- A execução real no Firefox e a disponibilidade da alternativa HLS do provedor não foram verificadas nesta sessão. Não afirmar reprodução contínua comprovada.

## Próximo passo
Recarregar o app e testar o canal. O console deverá indicar `Switching finite TS response to HLS` quando houver candidato suportado, ou `Reconnecting after HTTP end` quando reabrir a fonte original. Registrar o resultado real antes de considerar o incidente encerrado. Nenhum commit ou deploy foi feito.
