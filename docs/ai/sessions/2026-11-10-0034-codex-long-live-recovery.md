# Falha de recuperação após cinco minutos
Data/hora: 2026-11-10 00:34 (America/Recife)
Ferramenta: Codex
Estado: tratamento transitório e diagnóstico implementados e verificados; causa do travamento observado ainda não identificada
Objetivo: separar falhas de transporte de rejeição de timestamps e validar recuperação prolongada.
Arquivos em uso: liveTsLoader.ts/spec; liveTsContinuity.ts; VideoPlayer.vue (somente log de recuperação); mpegtsPipeline.spec.js e suporte de testes; docs/ai/CONTEXT.md.

## Evidência
- Usuário relata aproximadamente cinco minutos até travar e exibir erro.
- Print: currentTime 328,529 s, readyState 2, velocidade zero, tentativas de recuperação e erro genérico “stopped advancing after three requests”. Não há HTTP 444 neste print.
- Código atual agrupa no mesmo contador EOF vazio, erro HTTP recuperável, exceção de rede e dados descartados pelo filtro. Três respostas vazias/503 rápidas podem desistir em menos de um segundo, enquanto três timeouts levam ~30 s. O print não distingue essas causas.
- Preservar stash, 100 ms após resposta útil e margem de latência de 2 s; não repetir a otimização revertida.
- Implementar janela limitada para falhas transitórias e diagnóstico por motivo/bytes/PES/status, sem URLs; manter rejeição de mídia repetida e 4xx permanente. Testar pelo menos seis minutos virtuais com falha temporária após cinco minutos e timestamps crescentes.

## Implementação e limites
- Falhas de transporte, respostas vazias e respostas apenas com tabelas TS recebem janela limitada a 30 s e até oito tentativas, com backoff de 1/2/4/5 s. A janela inclui tempo de leitura, não é renovada a cada falha e não é consumida pela pausa manual. Avanço de PES renova a recuperação. Uma conexão ativa por vez.
- Dados repetidos/rejeitados pelo filtro continuam limitados a três respostas; 4xx permanente (inclusive o 444 do print anterior) continua terminal. Não reescrever timestamps nem reiniciar o player automaticamente com base em hipótese de clock reset.
- Novo log `[Skue Live] HTTP recovery` contém reason/status, bytes recebidos, PES aceitos/rejeitados, candidatos a salto para trás maior que 30 s, tentativa, tempo de recuperação e decisão de repetir. Não inclui URL ou erro de rede original potencialmente sensível.
- `_needStash=true`, stash/latência e intervalo de 100 ms após resposta útil permanecem no estado restaurado. Sem alteração visual ou VOD.
- Usuário informou que ainda não havia clicado em Tentar Novamente. Retomada manual imediata não foi constatada; não usá-la como evidência.

## Testes executados
- 62 testes passaram; um diagnóstico HTTP opcional pulado por padrão. Build final passou após correção de narrowing de tipos TypeScript na classificação de resultados assíncronos; comparação movida para helper tipado, sem modificar a política de execução.
- Novo teste com seis minutos de mídia sintética e relógio virtual avançado 370 s: injeta HTTP 503, EOF vazio e exceção de rede após onze respostas de 30 s (5m30). Recupera na mesma instância e entrega >357 s de áudio/vídeo, sem intervalos regressivos, lacunas >=100 ms, erro IO/demux nem LOADING_COMPLETE.
- Fixture sintética reutilizada somente em memória, deslocando PTS/DTS no suporte de teste. O remuxer corrige pequenas sobreposições AAC nas fronteiras das cópias (avisos de descarte de quadros); não confundir esse teste com uma transmissão real de seis minutos nem com renderização/MediaSource no Firefox.
- Novos testes: retomada após três falhas rápidas, término limitado quando resposta continua vazia, pausa longa sem esgotar orçamento, distinção entre sobreposição curta e candidato a reset de relógio. Testes anteriores de cancelamento, 4xx, repetição, ausência de dados, worker/VOD e continuidade permanecem passando.
- Diagnóstico local HTTP real/FFmpeg passou em 33,41 s com três respostas sobrepostas e 27 fragmentos de cada trilha decodificados sem erros. Nenhuma leitura externa da conta nesta rodada.
- Não identificado por que a fonte deixou de avançar no Firefox em 328 s. Se repetir, o novo log permite distinguir transporte de dados recebidos e descartados. Reprodução real prolongada continua pendente.
