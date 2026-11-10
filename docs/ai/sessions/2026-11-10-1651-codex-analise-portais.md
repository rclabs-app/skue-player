# Comparação de portais e oportunidades do Skue
Data/hora: 2026-11-10 16:51 (America/Recife)
Ferramenta: Codex
Estado: concluído; relatório entregue, sem implementação
Objetivo: comparar cinco sites distintos enviados pelo usuário (Duplecast repetido) com o portal Laravel e propor melhorias priorizadas.
Arquivos em uso: este registro e docs/ANALISE_COMPETITIVA_PORTAL.md (novo relatório). Leitura de rotas, controllers, modelos, views Blade, portal Vue e testes. Sem edição funcional.
Mudanças e decisões: preservar alterações preexistentes em README, contexto e onboarding e registros de APK. Separar evidência pública, comportamento estático de código e propostas. Sem contas, pagamentos ou envio de listas a concorrentes.
Verificações executadas e resultados: páginas públicas consultadas por ferramenta web; tentativa de inspeção visual não disponível (browser access host unavailable). Laravel tem portal Blade por sessão e Vue tem portal via API/token com funcionalidades divergentes. Registros recentes relidos. Canvas lido para avaliar formato; ambiente não apresenta diretório gerenciado correspondente ao workspace, portanto relatório portátil no repositório.
Pendências e próximo passo: concluir rastreio, priorizar propostas, registrar limitações e fontes.

## Resultado
- Relatório em docs/ANALISE_COMPETITIVA_PORTAL.md: cinco referências, capacidades existentes, evidências e prioridades 0/1/2, arquitetura proposta, critérios de aceite e métricas ainda não medidas.
- Identificadas divergências Blade/API em operações, validação e principal; licença Blade calculada pela chave; preços/planos divergentes entre landing e checkout; links legais sem destino e menu móvel ausente no template.
- Evidência de código: handshake público devolve chave/token de aparelho existente sem prova de posse; tokens do portal sem expiração/revogação no resolvedor. Não explorados dispositivos reais.
- HTTP local: /portal = 200; HEAD /downloads/skue-tv.apk = 200/APK/8.620.879 bytes; /download/skue-tv.apk = 200/APK/8.628.163 bytes. Inspeção posterior corrigiu hipótese inicial de link quebrado: são arquivos estáticos diferentes. Ambos diferem do APK em download/skue-tv.apk (8.680.456 bytes); três hashes locais distintos. Nenhum binário alterado.
- A primeira tentativa de HTTP local expirou na revisão automática de permissão; repetição simples autorizada e concluída. Sem bloqueio restante de HTTP.
- Nenhuma conta, pagamento, playlist real ou reprodução de concorrente utilizada. Sem notas arbitrárias ou alegações de superioridade medida. Sem testes de aplicação/build nesta análise documental.
- Alterações preexistentes preservadas integralmente. Sem edição de código, ativação de assinatura, commits, push ou publicação.
- Pendências: validação visual, áreas autenticadas de concorrentes e aprovação de escopo para implementação. Propostas não equivalem a requisitos aprovados.
