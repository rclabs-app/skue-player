# Ampliar cartão de configuração
Data/hora: 2026-11-10 18:53 (America/Recife)
Ferramenta: Codex
Estado: concluído; conferência visual pendente
Objetivo: ampliar cartão, QR Code, textos e dados de ativação em desktop/TV, preservando layout compacto em telas baixas.
Arquivos em uso: web/src/views/OnboardingView.vue (somente template/estilo), este registro e contexto.
Mudanças e decisões: limitar ampliação a telas a partir de 1200 px de largura e 550 px de altura; manter lógica de ativação e alterações preexistentes. Registros recentes concluídos relidos; sem edição ativa coincidente identificada.
Verificações executadas e resultados: git status/diff e template atual inspecionados. Cartão limitado a 896 px e QR a 144 px em desktop; área estreita quebra MAC.
Pendências e próximo passo: ampliar estilo e conferir build; inspeção visual depende de navegador disponível.

## Resultado
- Alterado somente template/estilo do OnboardingView: classes específicas e media query para desktop/TV. Largura máxima 896 -> 1280 px, layout com altura mínima 400 px mais padding, QR até 208 px, logo 72 px, textos maiores e chave de 40 px. MAC em uma linha na faixa ampliada.
- Telas abaixo de 1200 px de largura ou 550 px de altura conservam tamanhos compactos. Nenhuma alteração na lógica ou credenciais de ativação.
- Build vue-tsc/Vite passou e git diff --check passou. Sem novos testes unitários para ajuste visual; navegador de inspeção indisponível na sessão, aparência e medidas reais em dispositivos ainda dependem de conferência.
- Alterações preexistentes preservadas. Sem novo APK, commits ou push.
