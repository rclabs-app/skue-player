# Redesenhar OnboardingView em modo paisagem e responsivo
Data/hora: 2026-11-10 10:51 (America/Recife)
Ferramenta: Antigravity
Estado: concluído
Objetivo: Refazer o layout da view `web/src/views/OnboardingView.vue` em modo paisagem e garantir responsividade em telas baixas (como smartphones em modo paisagem) e Smart TVs/desktops, preservando o estilo sóbrio (menos neon).
Arquivos em uso: `web/src/views/OnboardingView.vue`, `docs/ai/sessions/2026-11-10-1051-antigravity-onboarding-paisagem.md`
Mudanças e decisões:
- Substituído o container `min-h-screen` por `h-full w-full overflow-y-auto` para evitar corte vertical pelo `<main class="overflow-hidden">` de `App.vue`.
- Redesenhado o cartão de ativação em modo paisagem (`max-w-4xl`) com grid de 12 colunas (`landscape:grid-cols-12 sm:grid-cols-12`):
  - Coluna esquerda (5 colunas): logotipo Skue, subtítulo, alerta de erro compacto, instruções em 2 passos numerados, botões de ação (`Recarregar Conexão` e `Início`) com suporte a foco de controle remoto e indicador de status de conexão.
  - Coluna direita (7 colunas): painel horizontal lado a lado (`landscape:flex-row sm:flex-row`) contendo o QR Code à esquerda e as credenciais do dispositivo (Endereço MAC e Chave de Ativação) à direita, com espaçamentos compactos para caber sem corte em telas móveis em modo paisagem (~360px de altura) e escalonamento amplo em telas grandes (`lg:`).
Verificações executadas e resultados:
- `npm run test` em `web/`: 8 arquivos de teste aprovados (62 testes aprovados, 1 pulado).
- `npm run build` em `web/`: `vue-tsc -b && vite build` concluído com sucesso sem erros.
Pendências e próximo passo: conferência visual pelo usuário no dispositivo Android / navegador em modo paisagem.
