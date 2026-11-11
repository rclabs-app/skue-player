# Banner das categorias
Data/hora: 2026-11-10 21:52 (America/Recife)
Ferramenta: Codex
Estado: concluído; conferência visual real pendente
Objetivo: corrigir banner congelado ao trocar categoria ou voltar da reprodução.
Arquivos em uso: MoviesView.vue, SeriesView.vue, LiveView.vue e teste das views; contexto e este registro.
Estado inicial: alterações anteriores de histórico preservadas. Views sem diff preexistente. Registros recentes consultados.
Diagnóstico: Filmes/Séries usam cinco itens globais no hero e mantêm hoveredItem indefinidamente; Live não limpa focusedChannel ao trocar categoria. Fetch em andamento descarta resets; metadados antigos ficam visíveis durante nova consulta.
Pendências: correção e validação automatizada.


## Resultado
- Filmes usa os cinco primeiros itens do resultado ativo; Séries deriva o hero da lista filtrada. Troca limpa seleção anterior/índice; categorias vazias não exibem banner antigo.
- Mouseleave/blur dos cartões libera seleção e reinicia rotação do banner de Filmes/Séries. Metadados anteriores são limpos antes de consultar o novo item e timeouts são limpos no unmount.
- Lives limpa focusedChannel ao trocar resultado e ao fechar reprodução destaca o primeiro item da lista atual. EPG atrasado não substitui o do canal atual.
- Fetch paginado de Filmes/Lives aceita reset enquanto outra consulta está pendente e ignora resultado antigo por versão.
- Cinco testes de views: troca após hover e favoritos vazios nas três telas, resposta atrasada de categoria e fechamento do player Live. Suíte total: 89 aprovados, 1 diagnóstico opcional ignorado. Build TypeScript/Vite e diff check aprovados.
- Sem leitura de streams/contas ou validação visual em navegador/TV real; sem APK, commits ou push. Alterações anteriores preservadas.
