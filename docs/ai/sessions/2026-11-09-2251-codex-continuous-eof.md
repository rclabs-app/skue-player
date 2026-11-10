# Recuperação de EOF preservando o buffer
Data/hora: 2026-11-09 22:51 (America/Recife)
Ferramenta: Codex
Estado: implementação e verificações de transporte/processamento concluídas; renderização real no Firefox pendente
Objetivo: implementar recuperação de respostas TS finitas sem destruir MediaSource a cada reconexão.
Arquivos em uso: novos helpers/testes de transporte e continuidade MPEG-TS em web/src/lib; mpegtsConfig.ts; VideoPlayer.vue/spec; docs/ai/CONTEXT.md.

## Análise das alternativas
- Trocar URL/HLS: descartado como solução geral pelos testes reais, incluindo 404/405 e EOF também na rota explícita.
- Aumentar buffer: reduz jitter, mas não transforma EOF em entrada contínua.
- Recriar player no evento ended: recuperação atual esgota e perde buffer; provoca carregamento e limite de reconexões em fontes com respostas curtas.
- Recuperar o transporte no EOF antes de esgotar o buffer: alternativa escolhida, usando customLoader público da mpegts.js. Reconexões sequenciais à URL original, sem emitir conclusão a cada resposta.
- Diferencial obrigatório em relação às tentativas anteriores: detectar sobreposição pelo DTS/PTS por PES (não por prefixo PAT/PMT), não juntar pacotes/PES truncados entre respostas, não modificar campos privados nem timestamps do demuxer/remuxer. Respostas repetidas/sem avanço devem terminar com erro limitado.
- customLoader contém funções e não é clonável para o worker da biblioteca; desabilitar esse worker apenas para este transporte live. VOD mantém loader padrão e worker.
- Validar integração real demux/remux com múltiplas respostas sobrepostas, cancelamento, inatividade e ausência de progresso. Não declarar Firefox corrigido sem reprodução real.

## Implementação
- `liveTsLoader.ts`: customLoader público, uma conexão por vez, reabertura no EOF mantendo o transmuxer e MediaSource abertos. Não reporta onComplete para respostas individuais. Cancela em pausa/fechamento, limita a três respostas sem avanço, cancela leituras sem dados ou progresso por 10 s, aguarda o consumo do buffer antes de abrir outra resposta. HTTP 4xx permanente encerra sem loop. Não transmite Range de arquivo para live.
- `liveTsContinuity.ts`: reagrupa pacotes TS de 188 bytes e PES completos, usa DTS (PTS quando DTS ausente) por PID para retirar sobreposição; preserva os clocks originais e aceita wrap de 33 bits. Descarta caudas truncadas sem marcar seu timestamp como entregue. Limites de tamanho por PES e total em memória.
- `mpegtsConfig.ts`: stash de 128 KiB para live; worker desativado apenas quando customLoader live contém funções não clonáveis. `VideoPlayer.vue` usa esse transporte em live HTTP e mantém mensagem acionável em falha definitiva. As alterações preexistentes de visual/VOD/assinatura foram preservadas.

## Verificações
- Suíte final: 57 testes passaram; 1 diagnóstico HTTP opcional pulado por padrão. Build final (vue-tsc + Vite) passou. Diff do componente sem erros de whitespace.
- Integração sintética real: três respostas HTTP finitas e sobrepostas, ao longo de 33,4 s; pico de uma requisição ativa; nenhuma conclusão do stream; 27 fragmentos de áudio e 27 de vídeo decodificados em memória pelo FFmpeg, sem erros. Diagnóstico reproduzível em `liveTsHttp.spec.js`, com comando no README da fixture.
- Integração com a fonte original autorizada: três leituras sequenciais com o mesmo identificador de navegador/Origin aprovados, cada resposta limitada a 18 s e seguindo redirecionamentos do próprio serviço. Passou em 23,06 s: áudio 113 fragmentos até 27.884 ms; vídeo 133 fragmentos até 27.861 ms; nenhum intervalo inválido, nenhuma lacuna/sobreposição nos intervalos gerados, nenhum erro IO/demux e nenhum LOADING_COMPLETE. Não salvou vídeo nem registrou credenciais.
- O adaptador temporário do teste real inicialmente não seguia 302 e falhou; corrigido para seguir redirecionamentos como fetch/Python, sem alteração do produto para esse erro. Diagnóstico genérico arquivado em `/tmp/skue-liveProvider.diagnostic.spec.js`, removido da descoberta padrão da suíte.
- Teste unitário inicial acessava callback após destroy (que corretamente o limpa); corrigido capturando a referência antes. Na integração rápida, o stash retém a cauda até novos bytes; o limite verificado é >27 s, com continuidade em ambas as fronteiras, sem confundir o instante de entrega com duração total de entrada.

## Limites e decisões
- A fonte ainda encerra conexões: a implementação recupera esse comportamento; não identifica nem corrige o motivo no servidor/conta/rede.
- Reinício do relógio para timestamps antigos ou repetição sem novos PES para após três respostas sem avanço. Não força timestamps artificiais nem modifica objetos privados da biblioteca.
- O transporte customizado executa no thread principal; desempenho em Smart TVs ainda não foi medido. Limites de memória reduzem crescimento indevido.
- Testes reais comprovam transporte e demux/remux; o teste sintético comprova também decodificação FFmpeg. Nenhum deles comprova renderização/MediaSource no Firefox do usuário, cujo acesso permaneceu indisponível. É necessária reprodução nessa sessão após recarregar a aplicação.
- Sem commit, publicação ou contato com terceiros.
