# Testes de transporte e continuidade ao vivo
Data/hora: 2026-11-09 22:27 (America/Recife)
Ferramenta: Codex
Estado: verificações locais concluídas; aguardando confirmação de conta sem reproduções para teste externo isolado
Objetivo: comparar endpoints, respostas HTTP e timestamps antes de alterar novamente o player.
Arquivos em uso: diagnóstico temporário fora do repositório; possivelmente `web/src/components/VideoPlayer.vue`, helpers e testes de reprodução; `docs/ai/CONTEXT.md`.

## Autorização
O usuário já autorizou leitura do stream com as credenciais do próprio link e agora pediu “Faça todos os testes necessários para resolver isso tudo”. Testes de leitura no mesmo serviço serão sequenciais para não provocar concorrência artificial; nenhum vídeo ou credencial será gravado nos registros.

## Diagnóstico e escopo confirmado
- A matriz foi inicialmente recusada pela revisão automática por ampliar as rotas e identificadores. Após pergunta explícita, o usuário respondeu “Sim, autorizo os seis testes descritos”; os seis testes foram executados.
- Mesmo canal, leituras sequenciais: rota compacta HTTP 200, EOF em 6,84 s, ~10,8 s de timestamps; compacta com identificação VLC EOF em 7,08 s. Rota explícita `/live/conta/senha/canal.ts`: HTTP 200, recebimento ativo no limite de 18,75 s, ~20 s de timestamps. Compactas com extensões .ts/.m3u8: 404; HLS /live: 405.
- Hipótese testada e descartada antes de editar: a rota explícita poderia corrigir o problema. Na repetição, também encerrou (EOF em 6,13 s, 1.737.828 bytes, ~10,8 s de timestamps). Nenhuma alteração de seleção de URL foi aplicada.
- Decodificação desse recebimento em memória com FFmpeg: código de saída 0, com avisos de SPS/erro de macrobloco na entrada. Não comprova mídia isenta de falhas.
- Testes antes da edição: 41/41 e build passaram. Navegador real indisponível: host de acesso CUA não conectado.

## Verificação adicional de transporte real
- Teste diagnóstico temporário: servidor HTTP local, envio incremental de 30 segundos de H.264/AAC sintéticos durante 31 segundos reais, Controller/loader/demux/remux da mpegts.js instalada e configuração atual do app; decodificação dos MP4 fragmentados resultantes via FFmpeg em memória.
- Resultado final: passou em 31,19 s; uma única requisição GET, nenhuma conexão encerrada antes de 30 s, 31 fragmentos de áudio e 31 de vídeo decodificados sem mensagens de erro. Não testa MediaSource, worker nem renderização no Firefox.
- Primeira execução impedida por listen EPERM no sandbox; execução local escalada autorizada. Primeiro ensaio do servidor de teste contou OPTIONS como reprodução e falhou na asserção de uma requisição; corrigida a resposta CORS do servidor sintético e repetido com sucesso. Isso era defeito no teste, não no produto.
- Diagnóstico temporário arquivado em `/tmp/skue-mpegtsHttp.diagnostic.spec.js`; removido da descoberta padrão da suíte para não impor FFmpeg/portas locais aos testes normais. Nenhum código do produto foi alterado nesta sessão.

## Limites e próximo passo
- Os testes externos não comprovaram exclusividade da conta; reprodução do usuário pode concorrer com as leituras. Não concluir falha do provedor a partir desse resultado.
- Solicitado ao usuário interromper temporariamente todas as reproduções para repetir uma leitura isolada de até 18 s. Não executar essa leitura até receber confirmação.
- Solicitado também resultado do mesmo canal em outro player no mesmo computador/rede. Esse teste e acesso real ao Firefox ainda faltam.
