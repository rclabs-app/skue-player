# Loop de reconexões após alguns segundos
Data/hora: 2026-11-09 22:11 (America/Recife)
Ferramenta: Codex
Estado: correção local concluída; diagnóstico direto aguardando autorização do usuário
Objetivo: impedir o loop ilimitado e obter evidência de transporte antes de novas mudanças de protocolo.
Arquivos em uso: `web/src/components/VideoPlayer.vue`, testes do componente e `docs/ai/CONTEXT.md`.

## Evidência
- Os prints mostram EOFs sucessivos e `Reconnecting after HTTP end` sempre como tentativa 1.
- O contador era zerado por `video.currentTime >= 3`, mesmo com encerramentos a cada poucos segundos. Isso não demonstra estabilidade e permite loop sem limite.
- A recuperação anterior não resolveu a reprodução real; recriar MediaSource repetidamente causa tela preta/carregamento.
- A tentativa de leitura de diagnóstico do stream foi bloqueada pela revisão automática: considerou necessária autorização específica para enviar ao servidor as credenciais presentes no endereço. Não repetir nem contornar a restrição sem autorização.

## Correção e verificação
- Removido o reset baseado em `currentTime >= 3`. Esse critério introduzido pelo Codex permitia renovação indefinida das tentativas, como os prints confirmaram.
- Nova política: até três reconexões automáticas em janela móvel de 60 segundos; em excesso, encerra as tentativas e exibe “Conexão instável”. A passagem do tempo não reinicia sozinha um player já parado por erro; a ação manual pode iniciar outra sessão.
- Testes reproduzem quatro respostas que chegam a dez segundos de posição e verificam que não há reinício infinito; também cobrem liberação da janela após um minuto e tentativa manual após o limite.
- `npm --prefix web run test -- --silent`: 41/41 testes aprovados.
- `npm --prefix web run build`: TypeScript e build aprovados.
- `git diff --check -- web/src/components/VideoPlayer.vue`: sem erros.

## Limite e próxima ação
A origem das interrupções ainda não foi resolvida. Solicitar autorização para uma leitura curta (até 20 segundos) do stream já mostrado, usando as credenciais do próprio endereço no servidor de transmissão, sem salvar mídia. O objetivo é medir status, cabeçalhos e término da resposta antes de propor nova alteração. A revisão automática rejeitou essa ação porque interpretou que o uso dessas credenciais no destino externo ainda não estava especificamente autorizado. Nenhum commit ou deploy foi feito.
