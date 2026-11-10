# Leitura isolada após interrupção das reproduções
Data/hora: 2026-11-09 22:40 (America/Recife)
Ferramenta: Codex
Estado: leituras isoladas concluídas; causa externa exata e reprodução contínua ainda não resolvidas
Objetivo: repetir leitura externa sem concorrência informada da conta.
Arquivos em uso: diagnóstico temporário em /tmp; este registro; docs/ai/CONTEXT.md.

## Confirmações do usuário
- O mesmo canal também para em outro player no mesmo computador/rede.
- “Pronto, todas as reproduções estão paradas”.
- Mantida autorização já concedida para as rotas original e TS explícita: leituras sequenciais de até 18 segundos, sem salvar mídia nem registrar credenciais.

## Resultados
- Original compacta: HTTP 200, video/mp2t, EOF após 7,47 segundos, 1.654.848 bytes, timestamps de vídeo abrangendo 10,21 segundos.
- TS explícito, leitura seguinte: HTTP 200, ainda recebendo no limite de 18,75 segundos, 3.925.728 bytes, timestamps abrangendo 24,19 segundos.
- Confirmação isolada do TS explícito: HTTP 200, EOF após 8,10 segundos, 1.728.992 bytes, timestamps abrangendo 10,74 segundos. FFmpeg decodificou em memória com saída 0 e aviso de SPS ausente no início.
- Nenhum vídeo salvo. Nenhuma alteração de código do produto aplicada; hipótese de simples troca de rota continua descartada.

## Conclusão e limites
- Reproduzido fim da resposta HTTP fora do Skue, com demais players parados segundo confirmação do usuário. Corrobora relato de falha em outro player. Não é um problema exclusivo do Firefox nem provocado exclusivamente pelo ciclo de reconexão do componente.
- Não é possível distinguir servidor de origem, restrição de conta ou intermediário/caminho de rede apenas com essas leituras. A pausa de todos os players reduz a hipótese de concorrência imediata, mas não prova o estado interno da conta.
- Acesso à sessão real do Firefox indisponível. Testes locais e build já haviam passado na rodada anterior; não repetidos porque nenhum código mudou.
- Para avançar: comparar a mesma fonte em outra rede com uma reprodução por vez, ou obter do responsável pela fonte a verificação de encerramento da conexão/restrições da conta. Não contatar terceiros sem instrução do usuário.
