# Manter último destaque do banner
Data/hora: 2026-11-10 21:57 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: manter último item apontado após saída do mouse ou foco; reset apenas na troca de seção.
Arquivos em uso: MoviesView.vue, SeriesView.vue, catalogHero.spec.ts, CONTEXT.md e este registro.
Diagnóstico: releaseHero adicionado na sessão anterior limpa hoveredItem em mouseleave/blur. Live já conserva destaque ao sair do cartão. Mudanças anteriores revisadas e preservadas.

Resultado: removido reset mouseleave/blur em Filmes/Séries; Live já mantém seleção. Testes nas três views cobrem saída do mouse, perda de foco, espera de 12s, novo foco e troca de categoria. 92 testes aprovados, 1 diagnóstico opcional ignorado; build e diff check aprovados. Sem validação visual real, commits ou push. Regra atual substitui liberação de hover descrita na sessão 2152.
