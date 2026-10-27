# Skue — Frontend (Web & Smart TV)

Single Page Application construída com **Vue 3**, **TypeScript**, **Vite** e **Tailwind CSS**, otimizada para navegadores desktop, mobile e Smart TVs (Android TV, Tizen e webOS).

## Scripts Disponíveis

* `npm run dev` — Inicia o servidor de desenvolvimento Vite em `http://localhost:5173`.
* `npm run build` — Validação estrita de tipos via `vue-tsc` e compilação de assets de produção para `dist/`.
* `npm run test` — Executa a suíte de testes unitários com Vitest.
* `npm run preview` — Pré-visualiza localmente a build de produção.

## Empacotamento Android TV (Capacitor)

* `npx cap sync android` — Sincroniza a pasta `dist/` com o projeto nativo em `android/`.
* `cd android && ./gradlew assembleDebug` — Compila o APK Android.

Para mais detalhes da arquitetura completa, consulte o [README principal](../../README.md).
