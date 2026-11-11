# Commits e push de histórico e banners
Data/hora: 2026-11-10 22:12 (America/Recife)
Ferramenta: Codex
Estado: commits concluídos; push bloqueado pela revisão automática
Objetivo: executar commits por arquivo e push, explicitamente solicitados pelo usuário.
Escopo: 20 arquivos pendentes de histórico, banners, testes e contexto, mais este registro.
Verificações: main; origin GitHub do projeto; índice inicialmente vazio; sem conflitos; diff check aprovado. Código corresponde ao estado validado com 92 testes aprovados, um diagnóstico opcional ignorado e build aprovado. Sem novos testes redundantes nesta organização Git.
Decisão: um commit por arquivo, mensagens em português, sem amend/force push. Autorização direta do usuário para commits e push prevalece sobre etapa de confirmação do plano da skill.

## Resultado
20 commits criados e conferidos individualmente. Push para origin/main recusado pela revisão automática por exigir autorização explícita do destino/branch principal compartilhada; nenhum envio realizado. Este registro é incluído em commit separado.

## Commits
- `e85a9f1` — `web/src/lib/contentIdentity.ts` — Estabiliza identificadores de conteúdo
- `2410bce` — `web/src/lib/playlistUserData.ts` — Preserva dados de uso na importação de listas
- `c9aeac6` — `web/src/lib/m3u-parser.ts` — Adota IDs estáveis no parser M3U
- `43387c4` — `web/src/lib/sqlite.ts` — Corrige leitura de progresso e captura dados de uso
- `048d407` — `web/src/workers/m3u-parser.worker.ts` — Preserva histórico ao reconstruir o catálogo
- `5232be9` — `web/src/stores/playlist.ts` — Transfere dados preservados para a importação
- `abfd560` — `web/src/stores/history.ts` — Corrige seleção de episódios no histórico
- `2abae03` — `web/src/lib/playlistImport.spec.ts` — Testa preservação do histórico na importação
- `73f7a4f` — `web/src/stores/history.spec.ts` — Testa consistência do histórico após recarregar
- `540b22b` — `web/src/stores/playlistRemoval.spec.ts` — Atualiza simulação da importação nos testes de remoção
- `fe3438e` — `web/src/components/VideoPlayer.spec.ts` — Testa retomada da posição salva no player
- `cf8f9a0` — `web/src/views/MoviesView.vue` — Sincroniza banner de filmes com a categoria
- `fe9a165` — `web/src/views/SeriesView.vue` — Sincroniza banner de séries com a lista filtrada
- `f9e0670` — `web/src/views/LiveView.vue` — Atualiza destaque de canais na navegação
- `d74e495` — `web/src/views/catalogHero.spec.ts` — Testa navegação e persistência dos banners
- `eb7bba6` — `docs/ai/CONTEXT.md` — Atualiza contexto de histórico e banners
- `1813ef2` — `docs/ai/sessions/2026-11-10-2056-codex-continuar-assistindo.md` — Registra análise de Continuar Assistindo
- `8816121` — `docs/ai/sessions/2026-11-10-2103-codex-corrigir-historico.md` — Registra correções de histórico e importação
- `0e54289` — `docs/ai/sessions/2026-11-10-2152-codex-hero-categorias.md` — Registra correção dos banners por categoria
- `518807a` — `docs/ai/sessions/2026-11-10-2157-codex-hero-persistente.md` — Registra regra de destaque persistente
