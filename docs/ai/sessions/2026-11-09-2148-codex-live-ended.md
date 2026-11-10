# Canais que encerram e retornam à lista
Data/hora: 2026-11-09 21:48 (America/Recife)
Ferramenta: Codex
Estado: implementação concluída; causa específica no Firefox pendente dos logs
Objetivo: tratar término inesperado de um canal ao vivo sem fechar o player.
Arquivos em uso: `web/src/components/VideoPlayer.vue`, `web/src/components/VideoPlayer.spec.ts`, `docs/ai/CONTEXT.md`.

## Contexto
- Usuário respondeu que alguns canais travam e outros fecham e retornam à lista; não lembra quando começou.
- `LiveView.vue` remove o player somente ao receber `close`; o tratamento de `error` não o remove.
- O callback `onNativePlayerEnded` chamava `handleClose()` sem distinguir live de VOD. Esse caminho explica um fechamento no player nativo; ainda não comprova a origem do fechamento no Firefox.
- O vídeo HTML5 não possuía handler de `ended`; em live, um encerramento podia deixar o último quadro na tela sem explicação.

## Alterações e verificações
- Adicionado `handlePlaybackEnded`: em live, mantém a tela aberta e mostra “Transmissão interrompida” com a ação de tentar novamente já existente. Na reprodução nativa de VOD, preserva o fechamento ao término.
- Vinculado `ended` do HTML5 ao handler; o callback nativo agora só atua na plataforma nativa.
- Testes verificam live HTML5 encerrado com retry, live nativo sem emissão de close e VOD nativo mantendo close.
- `npm --prefix web run test`: 20/20 testes aprovados.
- `npm --prefix web run build`: tipagem e build concluídos sem erros.
- `git diff --check -- web/src/components/VideoPlayer.vue`: sem erros.
- Não foi comprovado o mecanismo do fechamento no Firefox nem resolvida a origem dos travamentos. Próxima evidência necessária: logs `[Skue Live]` no navegador com a versão atual.
