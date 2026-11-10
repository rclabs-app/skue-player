# Reserva de reprodução e entrega de mídia
Data/hora: 2026-11-10 00:15 (America/Recife)
Ferramenta: Codex
Estado: implementação e verificações concluídas; efeito no preload real ainda depende de observação do usuário
Objetivo: reduzir pausas curtas preservando a recuperação contínua já validada pelo usuário.
Arquivos em uso: liveTsLoader.ts/spec, mpegtsConfig.ts, mpegtsPipeline.spec.js, liveTsHttp.spec.js e testes de reserva de reprodução; docs/ai/CONTEXT.md.

## Evidência e proposta
- Usuário relata melhora de 90%, com preload ocasional; atribuição à internet é hipótese, não diagnóstico medido.
- O loader já agrupa TS/PES completos; IO stash adicional pode reter mídia utilizável até chegar outra resposta (teste anterior entregava >27 s de uma entrada de 30 s).
- O controle de latência atual salta para apenas 2 s antes do fim do buffer quando ultrapassa 15 s. Isso reduz a reserva disponível para reconectar; aumentar a reserva para 6 s apenas no transporte HTTP contínuo, preservando o teto de 15 s.
- Eliminar a espera fixa de 100 ms após respostas com avanço; manter backoff e limites quando não houver avanço, sem conexões simultâneas.
- Medir a entrega no teste de mídia real, testar a reserva com o controlador de latência da biblioteca e repetir HTTP sintético/FFmpeg. Sem interferir na conta real em reprodução pelo usuário.

## Alterações
- Desativado o IO stash adicional somente para o customLoader live, que já reagrupa TS/PES. Mídia completa segue imediatamente ao demux/remux e fica disponível para reprodução durante a próxima abertura HTTP.
- Reserva do controle de latência aumentada de 2 para 6 s somente no transporte contínuo; teto de correção permanece 15 s. Não impõe espera inicial de 6 s nem modifica VOD, pause ou loader padrão. Pode aumentar em até ~4 s a distância do ponto mais recente quando o controle corrige atraso acumulado.
- Respostas com avanço reconectam sem a espera artificial de 100 ms. Respostas vazias/repetidas conservam backoff e limite; permanece uma requisição ativa por vez.

## Verificações realmente executadas
- 60 testes passaram; um diagnóstico HTTP opcional é pulado na suíte normal. Build vue-tsc/Vite passou.
- Teste integrado com áudio/vídeo MPEG-TS reais sintéticos e respostas sobrepostas: agora exige >29 s entregues da entrada de 30 s antes de chegar mídia na quarta resposta; o teste anterior só exigia >27 s devido à retenção no stash. Nenhum timestamp regressivo ou intervalo de mais de 100 ms.
- Controle de latência real da biblioteca: após corrigir buffer acumulado e simular 3,5 s sem novos dados, a configuração contínua mantém mais de 2 s de reserva; configuração padrão com 2 s de margem já ficaria sem dados. Teste é simulação determinística, não reprodução visual.
- Diagnóstico opcional HTTP/FFmpeg: passou em 33,21 s; três respostas sobrepostas, pico de uma requisição, >29 s de mídia por trilha, 28 fragmentos de áudio e 28 de vídeo decodificados sem erros.
- Testado início imediato da próxima resposta útil sem requisições simultâneas e preservação de backoff/cancelamento. Dois testes antigos pressupunham a espera removida; ajustadas as fontes sintéticas para isolar cancelamento de backoff e espera por consumo do buffer.
- Nenhuma leitura externa da conta foi feita nesta rodada. Não revalidada a renderização no Firefox. A atribuição dos preloads à internet continua hipótese; a confirmação de melhora de 90% veio do usuário.
- Nenhuma alteração visual, commit, publicação ou mudança da assinatura.
