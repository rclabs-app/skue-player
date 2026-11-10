# Reversão das otimizações após regressão relatada
Data/hora: 2026-11-10 00:20 (America/Recife)
Ferramenta: Codex
Estado: reversão concluída e verificada localmente; retomada da reprodução no Firefox depende de confirmação
Objetivo: restaurar exatamente os parâmetros de transporte que o usuário confirmou como 90% melhores.
Arquivos em uso: liveTsLoader.ts/spec, mpegtsConfig.ts, mpegtsPipeline.spec.js, liveTsHttp.spec.js; remoção do teste de reserva introduzido na rodada anterior; docs/ai/CONTEXT.md.

## Evidência
- Usuário relata “Quebrou tudo” após a otimização.
- Print mostra HTTP 444 na URL redirecionada, corpo de mídia vazio, currentTime/decodedFrames em zero, erro terminal do loader. Isso prova rejeição antes da decodificação; não identifica qual parâmetro a provocou nem comprova que retirar o stash causou a rejeição.
- Restaurar stash ligado, margem de latência de 2 s e intervalo de 100 ms após respostas úteis. Preservar recuperação contínua, filtragem de sobreposição, backoff e limites anteriores.
- Não realizar leituras concorrentes da conta nem inventar tratamento de token/444 sem evidência adicional.

## Resultado
- Revertidas as três otimizações e os testes que dependiam delas; teste de reserva experimental arquivado em /tmp. Recuperação contínua e demais alterações preexistentes preservadas.
- Build passou. O identificador do bundle principal coincide com o registro do build anterior à otimização: `index-I_Zpmvjj.js`; CSS principal também coincide. Comparação feita entre os logs locais preservados, não por suposição de estado do Git.
- Suíte final: 57 testes passaram; um diagnóstico HTTP opcional pulado por padrão. Primeiro ensaio ainda descobriu o teste experimental durante sua remoção e falhou; repetição com a árvore final passou.
- Nenhuma leitura da conta, commit ou publicação. Não comprovado qual fator gerou HTTP 444; reversão restaura o comportamento confirmado pelo usuário, não comprova que o servidor já voltou a aceitar a reprodução.
