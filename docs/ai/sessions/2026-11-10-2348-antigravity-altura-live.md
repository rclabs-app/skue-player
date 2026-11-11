# Altura dos itens da view de Live (/live)
Data/hora: 2026-11-10 23:48 (America/Recife)
Ferramenta: Antigravity
Estado: concluído
Objetivo: aumentar a altura dos cartões da grade de canais na view `/live` (`LiveView.vue`), conforme solicitado pelo usuário com captura de tela.
Arquivos em uso: `web/src/components/ContentCard.vue`, `web/src/views/LiveView.vue`, `web/src/views/catalogHero.spec.ts`, `docs/ai/CONTEXT.md` e este registro.
Mudanças e decisões:
- Identificado no `git status` e em `docs/ai/sessions/2026-11-10-2308-codex-altura-live.md` que uma sessão anterior do Codex havia iniciado a adição da prop `isSquare` (`aspect-square` no container e altura `360` no otimizador de imagens) em `ContentCard.vue` e `:is-square="true"` em `LiveView.vue`, mas foi interrompida antes de executar a suíte de testes e concluir o registro.
- Preservadas as alterações em `ContentCard.vue` e `LiveView.vue` (que aumentam a altura do container de `16:9` / `aspect-video` para `1:1` / `aspect-square`, ~78% mais alto na mesma largura das 6 colunas, mantendo `object-contain` para não cortar logos nem capas verticais).
- Adicionado teste automatizado em `web/src/views/catalogHero.spec.ts` verificando que `LiveView` repassa `isSquare: true` e `isPortrait: false` para `ContentCard` e que `ContentCard` aplica `.aspect-square` e `w=360&h=360`.
Verificações executadas e resultados:
- `npm --prefix web test`: 13 arquivos aprovados (1 diagnóstico opcional pulado), 95 testes aprovados.
- `npm --prefix web run build`: `vue-tsc -b && vite build` concluído com sucesso.
Pendências e próximo passo: conferência visual pelo usuário no navegador/TV; se desejar uma proporção ainda mais vertical (como `4:5` ou `2:3`), basta ajustar a classe em `ContentCard.vue`.
