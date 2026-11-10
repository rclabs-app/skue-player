# Medição direta do stream autorizada pelo usuário
Data/hora: 2026-11-09 22:21 (America/Recife)
Ferramenta: Codex
Estado: diagnóstico de transporte concluído; teste isolado de concorrência pendente
Objetivo: medir a resposta HTTP do stream fora do Firefox e do player web.
Arquivos em uso: registro desta sessão e `docs/ai/CONTEXT.md`.

## Autorização e execução
- O usuário respondeu “Sim” à solicitação explícita de leitura de até 20 segundos do stream mostrado, usando as credenciais do endereço no servidor de transmissão, sem salvar vídeo.
- A requisição de diagnóstico foi aprovada e executada. Foi usado um leitor HTTP em Python com Origin do app local; não houve decodificação ou MediaSource.
- O vídeo não foi salvo. URL, credenciais e endereços de redirecionamento não foram incluídos neste registro.

## Resultado observado
- Status: HTTP 200.
- Content-Type: `video/mp2t`.
- Server: `nginx`.
- Connection: `close`.
- Access-Control-Allow-Origin: `*`.
- Sem Content-Length ou Transfer-Encoding nos cabeçalhos selecionados da resposta observada.
- Leitura terminou normalmente em EOF após 7,6 segundos desde o início da requisição.
- Total recebido: 2.922.416 bytes (aproximadamente 2,9 MB).

## Interpretação e limites
- Foi reproduzido o encerramento da entrada sem usar o player, o Firefox ou o mpegts.js.
- Isso não comprova defeito no provedor: a conexão pode ser encerrada por origem, intermediários, limites de conta ou disputa com outra reprodução ativa. O cabeçalho `Connection: close`, sozinho, também não prova a causa.
- Os prints mostram várias abas Skue abertas. Não foi confirmado quantas estavam reproduzindo nem qual o limite de conexões da conta.
- Próximo teste útil: manter somente uma reprodução ativa na conta, incluindo outros dispositivos, e observar se o canal continua encerrando. Não há evidência suficiente para mais mudanças no processamento de mídia nesta sessão.
- Não foram alterados arquivos da aplicação nem repetidos os testes/build, pois esta etapa foi somente de diagnóstico e documentação.
