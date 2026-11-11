# Altura dos cartões Live
Data/hora: 2026-11-10 23:08 (America/Recife)
Ferramenta: Codex
Estado: em andamento
Objetivo: aumentar altura dos cartões da grade Live indicados na imagem.
Arquivos em uso: ContentCard.vue, LiveView.vue e este registro.
Diagnóstico: grade usa seis colunas e thumbnails 16:9. Árvore inicialmente limpa; contexto e último registro consultados.
Decisão: thumbnails quadradas somente nessa grade, cerca de 78% mais altas para mesma largura, mantendo object-contain e seis colunas. Ajustar dimensão solicitada ao otimizador de imagens para evitar ampliação desnecessária. Filmes/séries e demais usos preservados.
