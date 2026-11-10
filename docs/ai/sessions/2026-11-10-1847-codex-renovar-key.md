# Nova chave após remoção do acesso
Data/hora: 2026-11-10 18:47 (America/Recife)
Ferramenta: Codex
Estado: concluído; teste manual no aparelho pendente
Objetivo: tratar exclusão administrativa como reinício do acesso, gerando nova chave para o mesmo aparelho sem restaurar conteúdo antigo.
Arquivos em uso: Api/DeviceController.php, DeviceRemovalTest.php, web/src/stores/playlist.ts e playlistRemoval.spec.ts, OnboardingView.vue, contexto e este registro.
Mudanças e decisões: pedido atual substitui bloqueio permanente da sessão anterior. Marcador identifica necessidade de limpeza, mas não impede novo cadastro. Preservar identidade do aparelho, invalidar tokens antigos pela troca de ID e manter conteúdo anterior eliminado. Sem mudança na pausa da assinatura.
Verificações executadas e resultados: status/diffs, contexto e última sessão lidos. Identificados retornos 410 no handshake que tornavam a remoção um impedimento ao novo acesso.
Pendências e próximo passo: retornar nova chave com sinal de reset, limpar cliente antes de carregar cache e testar estabilidade da nova chave em atualizações repetidas.

## Resultado
- Handshake de acesso removido agora cria novo cadastro vazio, com chave/token novos e reset_required. Marcador de remoção é consumido, não atua como banimento. Token de registro anterior sinaliza limpeza mesmo quando um pedido concorrente já cadastrou o novo acesso.
- App apaga conteúdo antigo antes de salvar nova identidade de acesso; mantém MAC físico/lógico, apresenta nova chave e permite configurar novamente. Mensagem de erro e texto de espera não exigem mais liberação manual do ADMIN.
- Chave estabiliza após o novo cadastro; chave/token anteriores não dão acesso. Testes verificaram autenticação no portal com a chave nova e recusa da antiga, listas vazias e não rotação em atualizações repetidas. Status blocked de um registro existente preservado.
- Backend: 39 testes/219 asserções passaram em SQLite em memória. Frontend: 76 testes passaram e um diagnóstico opcional ficou pulado; novo teste verifica limpeza na troca de registro e preservação do conteúdo nas sincronizações posteriores. Build vue-tsc/Vite e git diff --check passaram.
- Nenhum dispositivo real criado/excluído manualmente por ferramenta nesta tarefa; o cadastro ocorre quando o app solicita a chave. Sem migrations adicionais, alterações de cobrança, novo APK, commits ou push.
- Próximo passo: usuário clicar em Recarregar Conexão ou recarregar o app web para obter a chave nova. APK antigo exige nova compilação/instalação. Essa semântica substitui o comportamento de bloqueio permanente da tarefa anterior.
