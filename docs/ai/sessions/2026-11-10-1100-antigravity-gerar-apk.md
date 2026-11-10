# Gerar APK Android TV
Data/hora: 2026-11-10 11:00 (America/Recife)
Ferramenta: Antigravity
Estado: concluído
Objetivo: Gerar o APK Android (`app-debug.apk` / `download/skue-tv.apk`) com a versão atual do frontend (incluindo o novo layout em modo paisagem de `OnboardingView.vue`).
Arquivos em uso: `docs/ai/sessions/2026-11-10-1100-antigravity-gerar-apk.md`, `web/dist/`, `web/android/`, `download/skue-tv.apk`
Mudanças e decisões:
- Lido o registro concorrente `2026-11-10-1059-codex-commits-por-arquivo.md` e criado este registro separado.
- Sincronizados os assets do build web (`web/dist`) com o projeto Capacitor Android (`npx cap sync android`).
- Compilado o APK debug com `./web/android/gradlew -p web/android assembleDebug`.
- Copiado o binário gerado em `web/android/app/build/outputs/apk/debug/app-debug.apk` para `download/skue-tv.apk` (ambos ignorados pelo `.gitignore`).
Verificações executadas e resultados:
- `npx cap sync android`: assets copiados para `web/android/app/src/main/assets/public` e plugins atualizados.
- `./web/android/gradlew -p web/android assembleDebug`: `BUILD SUCCESSFUL in 21s` (183 actionable tasks: 27 executed, 156 up-to-date).
- Binários gerados e verificados em `web/android/app/build/outputs/apk/debug/app-debug.apk` e `download/skue-tv.apk`.
Pendências e próximo passo: instalação e teste do APK no dispositivo pelo usuário.
