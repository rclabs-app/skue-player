# Uso do contexto compartilhado

Abra a raiz `skue` nas duas ferramentas. O `AGENTS.md` da raiz orienta Codex e Antigravity a consultar a mesma base de contexto.

## Começar ou retomar

1. Leia `CONTEXT.md` e os registros recentes de `sessions/`.
2. Confira `git status --short`, os diffs e os arquivos antes de editar.
3. Crie um registro próprio com nome `AAAA-MM-DD-HHMM-ferramenta-assunto.md` (horário America/Recife) e declare os arquivos em que trabalhará.
4. Ao terminar, atualize esse registro. Atualize o contexto principal apenas se houver mudança duradoura.

Para uma conversa que já estava aberta quando estes arquivos foram criados, envie:

> Leia o AGENTS.md da raiz, docs/ai/CONTEXT.md e os registros recentes de docs/ai/sessions/. Use esses arquivos como contexto compartilhado com a outra ferramenta e registre o progresso desta sessão conforme as instruções.

## Trabalho simultâneo

- Distribua tarefas por arquivos. Um registro com estado `em andamento` indica o escopo ocupado, mas não implementa um lock.
- Se as tarefas exigirem os mesmos arquivos, use branches em worktrees separadas e integre os resultados depois. Branches na mesma pasta não isolam edições simultâneas.
- Cada ferramenta edita seu próprio registro. Releia o contexto principal antes de atualizá-lo para preservar mudanças feitas pela outra.
- Mudanças externas nem sempre entram imediatamente no contexto de uma conversa aberta: releia os arquivos ao retomar ou trocar de tarefa.

## Modelo de registro

```markdown
# Assunto
Data/hora: AAAA-MM-DD HH:MM (America/Recife)
Ferramenta: Codex ou Antigravity
Estado: em andamento / concluído / interrompido
Objetivo:
Arquivos em uso:
Mudanças e decisões:
Verificações executadas e resultados:
Pendências e próximo passo:
```

## Alcance da importação inicial

Foi consolidada a conversa Codex desta tarefa, os quatro pedidos do usuário recuperados da sessão local Antigravity vinculada ao workspace, documentos existentes e observações do Git. O registro da importação identifica as fontes e as limitações.

Não há sincronização dos bancos internos, cópia completa dos chats, processo em background ou importação automática de futuras mensagens. A continuidade depende de as ferramentas seguirem o `AGENTS.md` e manterem os registros atualizados. Nenhum histórico original foi modificado.

## Referências de descoberta de instruções

- Codex: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Antigravity: https://antigravity.google/docs/rules/ — documenta `AGENTS.md` na raiz do workspace como instrução continuamente ativa.

Não foi possível comprovar, nesta configuração, o carregamento dessas instruções em uma nova sessão de cada extensão. A mensagem de retomada acima permite solicitar a leitura explicitamente nas conversas atuais.

