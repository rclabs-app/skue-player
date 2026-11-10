# Proteções contra exclusão acidental
Data/hora: 2026-11-10 20:04 (America/Recife)
Ferramenta: Codex
Estado: concluído; conferência visual pendente
Objetivo: aplicar as quatro proteções propostas e aceitas: sem exclusão na listagem/em massa; exclusão na edição com MAC obrigatório e aviso de impacto.
Arquivos em uso: DeviceResource.php, Pages/EditDevice.php, DeviceRemovalTest.php, contexto e este registro.
Verificações: árvore inicialmente limpa. Listagem já não tem DeleteAction individual, mas mantém DeleteBulkAction. Edição usa DeleteAction padrão com atalho de teclado.
Decisões: validar MAC no servidor, remover atalho de exclusão e manter cascades/marcadores existentes. Auditoria e revisão de bloqueio não fazem parte das quatro medidas recomendadas para esta etapa.
Pendências: implementar e validar com testes Livewire sem excluir dados reais.

## Resultado
- Removida DeleteBulkAction; listagem permanece sem DeleteAction individual.
- Edição exige campo confirmation_mac obrigatório, validado no servidor contra MAC persistido. Modal apresenta nome, MAC, contagem de listas e aviso de perda de configuração ao sincronizar. Atalho mod+d removido.
- Testes Livewire verificam ausência das ações na listagem, conteúdo do modal, cancelamento, rejeição de MAC vazio/incorreto e exclusão válida com cascades e marcador.
- Suíte backend: 41 testes e 276 asserções aprovados em SQLite isolado. git diff --check aprovado. Nenhum dado real removido. Sem mudanças no frontend, build não necessário.
- Auditoria e mudanças no bloqueio permanecem propostas futuras. Sem commits ou push nesta tarefa.
