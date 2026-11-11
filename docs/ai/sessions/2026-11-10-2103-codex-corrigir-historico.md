# Correção de Continuar Assistindo
Data/hora: 2026-11-10 21:03 (America/Recife)
Ferramenta: Codex
Estado: concluído; validação visual pendente
Objetivo: preservar histórico na importação, estabilizar IDs com migração e corrigir seleção de séries.
Arquivos previstos: lib de identidade/importação, sqlite.ts, parser e worker M3U, stores playlist/history, testes de regressão e VideoPlayer.spec.ts, CONTEXT.md e este registro.
Estado inicial: apenas o registro da análise anterior não rastreado; nenhuma alteração de produto concorrente. Documentação consultada na análise e contexto relido.
Decisão: preservar dados de uso e configurações, sem transferir o catálogo inteiro ao worker; manter histórico de itens ausentes sem exibir cartões inválidos.
Pendências: implementação e testes/build; validação em aparelho real separada.


## Resultado
- IDs de conteúdo derivados de URL/nome, independentes da posição; parser principal e worker compartilham função. URLs diferentes continuam separadas. Alterações da própria URL/nome ainda representam outra identidade.
- Antes da importação, captura somente history, favorites, tmdb_cache e config. IDs legados são migrados via catálogo antigo; worker restaura esses dados no banco novo. Catálogo completo não é transferido. Histórico ausente do catálogo permanece armazenado, mas não aparece como cartão inválido.
- Store considera episódio mais recente antes de filtrar conclusão, inclusive após recarregar; ticks abaixo de 5s ignorados.
- Encontrado e corrigido adicionalmente: SELECT current_time sem qualificação retorna CURRENT_TIME do SQLite. Consultas agora delimitam a coluna; teste usa SQLite real e confirma 300 segundos tanto na listagem quanto na leitura individual.
- Teste do worker passa M3U reordenado, captura exportação e reabre SQLite verificando histórico migrado, favoritos, metadados e configuração. Teste de player cobre seek para posição salva sem sobrescrever com tick inicial.
- Verificações finais: 84 testes aprovados, 1 diagnóstico opcional ignorado; build Vue/TypeScript/Vite aprovado; git diff --check aprovado. Mock de playlistRemoval atualizado com captura de dados, mantendo teste de cancelamento por remoção aprovado.
- Sem testes em aparelho/navegador real, sem novo APK, commits ou push. Pausa da assinatura e estilo preservados.
- Limite: esta correção não recupera históricos já apagados por importações anteriores. Migração de ID legado exige que o item ainda conste no catálogo antigo.
- Risco de desempenho da exportação integral por tick não foi alterado nem medido; separar persistência de uso do catálogo exige mudança adicional de armazenamento e validação em TV. Mantida durabilidade atual por gravação.
