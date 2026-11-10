# Travamento recorrente da Live TV e rejeição em pause/play
Data/hora: 2026-11-09 21:26 (America/Recife)
Ferramenta: Codex
Estado: concluído na implementação; validação real no Firefox pendente
Objetivo: corrigir a continuidade do carregamento ao vivo e o tratamento de play() após pause.
Arquivos em uso: `web/src/components/VideoPlayer.vue`, módulo de carregamento e testes em `web/src/lib/`, testes do componente e `docs/ai/CONTEXT.md`.

## Evidência inicial
- Usuário informa que o travamento persiste e apresenta captura do Firefox com rejeição não tratada de play().
- `togglePlay()` chama `video.play()` sem tratar a Promise.
- O loader anterior decide descartar uma resposta inteira pela assinatura de apenas 15 pacotes iniciais; cabeçalhos repetidos não comprovam que o conteúdo inteiro é duplicado.
- A reconexão espera o buffer cair para 2,8 segundos; requisições sem novos bytes não possuem timeout.
- A adaptação do remuxer chama play() sempre que encontra o vídeo pausado, inclusive após pausa deliberada.
- Acesso automatizado ao navegador indisponível nesta sessão. Verificações serão locais e automatizadas, sem alegar reprodução real no Firefox.

## Mudanças e decisões
- Extraído o loader para `web/src/lib/continuousLiveLoader.ts` com testes independentes.
- Removida a deduplicação por prefixo de 15 pacotes, que podia descartar vídeo novo junto com cabeçalhos repetidos; pacotes curtos válidos passam a ser entregues sem aguardar esse prefixo.
- Reconexão inicia com até 10 segundos de reserva, em vez de 2,8 segundos. O cálculo usa o intervalo que contém a posição atual do vídeo.
- Timeout de 10 segundos para conexão/leitura sem novos bytes, repetição limitada para respostas sem dados e cancelamento por geração para impedir callbacks de conexões substituídas.
- O remuxer não chama mais play() ao receber dados, respeitando pausas manuais.
- Promise de play() tratada no controle e na inicialização MPEG-TS; abortos esperados não escapam como rejeição não tratada, falhas de formato mostram mensagem e bloqueio de autoplay mantém controles disponíveis.
- Limpeza de listeners e timer do player MPEG-TS antes da destruição; callbacks antigos não destroem o player de outro canal.
- `stopPlayback()` libera recursos antes de aguardar a gravação do progresso. A gravação antiga não pode encerrar um player iniciado enquanto ela estava pendente.
- Preservadas as alterações visuais preexistentes e as adaptações de timestamp da correção anterior. Estas ainda dependem de validação com o stream real.

## Verificações executadas
- `npm --prefix web run test`: 4 arquivos, 21/21 testes aprovados (13 novos).
- `npm --prefix web run build`: `vue-tsc -b` e Vite concluídos sem erros.
- Regressões cobertas: respostas finitas com mesmo cabeçalho e vídeo distinto, pacotes divididos entre reads, respostas curtas, reserva de buffer, read pendente, troca/abort de conexão, limite de respostas vazias, headers/credenciais, pause sem retomada indevida, play rejeitado, desmontagem, callback antigo e gravação assíncrona de progresso na troca de fonte.
- A tentativa de acesso HTTP ao Vite em `localhost:5173` neste ambiente não encontrou serviço acessível. Não foi comprovado HMR nem iniciada outra instância de servidor.

## Próximo passo
Recarregar o app servido no ambiente do usuário, abrir o canal e verificar reprodução por pelo menos um minuto, seguida de pause/play. Os testes locais não comprovam que o problema específico do servidor/canal foi eliminado no Firefox. Nenhum commit ou deploy foi feito.
