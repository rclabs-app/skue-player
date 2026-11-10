# Portal somente pelo Laravel
Data/hora: 2026-11-10 18:10 (America/Recife)
Ferramenta: Codex
Estado: concluído
Objetivo: retirar encaminhamento do portal pela porta 5173 e usar acesso direto ao Laravel na porta 8000.
Arquivos em uso: web/vite.config.ts, web/src/utils/portal.ts e portal.spec.ts; README.md; docs/ai/CONTEXT.md; este registro.
Mudanças e decisões: manter funcionalidades Blade e API implementadas; remover apenas proxies desnecessários e ajustar destino padrão de desenvolvimento e documentação. Demais alterações locais preservadas. Últimos registros concluídos relidos.
Verificações executadas e resultados: git status/diff e helper de URL conferidos antes das edições. QR e links já compartilham helper.
Pendências e próximo passo: ajustar, verificar testes de URL, build e acesso direto.

## Resultado
- Retirados somente os proxies /portal e /build do Vite; configuração Vite voltou ao estado original de HEAD, com proxy apenas /api para o player.
- Helper central de QR/links aponta diretamente ao host atual na porta 8000 em desenvolvimento; mantém override VITE_PORTAL_URL e fallback público nativo. Funcionalidades e API Laravel preservadas.
- README corrige endereço do portal e comando de APK local para API/portal em 8000; contexto atualizado preservando registros anteriores.
- Quatro testes de URL passaram; vue-tsc e build Vite passaram; git diff --check passou. HTTP GET http://192.168.0.27:8000/portal retornou 200.
- Nenhuma verificação visual ou geração de novo APK nesta tarefa. Sem commits ou push. Demais alterações anteriores preservadas.
