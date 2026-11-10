# Falha de ativação no APK Android
Data/hora: 2026-11-10 11:11 (America/Recife)
Ferramenta: Codex
Estado: APK local gerado e verificado; teste no celular pendente
Objetivo: diagnosticar erro de conexão relatado no celular e preparar APK de teste na rede local.
Arquivos em uso: web/src/views/OnboardingView.vue (URL do portal configurável), README.md (build local), docs/ai/CONTEXT.md, este registro; artefatos ignorados web/dist, web/android e download/skue-tv.apk.
Mudanças e decisões: preservar configuração de produção; informar API e portal locais por variáveis somente no comando de build. Registros recentes concluídos; sem edição ativa coincidente identificada.
Verificações executadas e resultados: árvore sem alterações rastreadas antes da tarefa; somente registro Antigravity de geração de APK não rastreado. Fluxo onboarding -> syncHandshake -> getApiUrl -> POST /api/v1/devices/handshake. web/.env.production define host api.skue.tv e bundle Android contém esse host. Consulta de health remoto falhou por resolução DNS neste computador; não comprova resposta exata no celular. Health local via Vite retornou HTTP 200/status ok. Manifest permite internet e HTTP. QR no aplicativo usa window.location.origin, inadequado para portal externo no APK.
Pendências e próximo passo: configurar portal opcional, validar build e gerar APK local; instalação e teste real dependem do usuário.

## Resultado
- Adicionado override opcional VITE_PORTAL_URL no onboarding; comportamento web padrão preservado. README documenta comando para build Android local; contexto atualizado.
- Build web passou com VITE_API_BASE_URL=http://192.168.0.27:5173 e VITE_PORTAL_URL=http://192.168.0.27:5173/portal. Sem edição de arquivos de ambiente.
- cap sync android passou; Gradle assembleDebug passou em 11 s, após execução com acesso ao cache Gradle fora do sandbox.
- ZIP do APK inspecionado: contém API e portal locais, não contém api.skue.tv nos bundles JS. Cópia entregue em download/skue-tv.apk, 8.680.456 bytes, SHA256 367c63716aebc814c0c639fbdc0a7049f02a9723b4413c98e5cc858007ce5e09.
- git diff --check passou. Nenhuma suíte unitária repetida; alteração funcional restrita a um override de URL e configuração do artefato.
- Não realizado handshake com dados do celular nem instalação ou teste de ativação no dispositivo. Celular e computador precisam estar na mesma rede, com Vite e backend ativos. Produção e DNS remoto não alterados.
- Registro Antigravity preexistente preservado. Sem commits ou push nesta tarefa.
