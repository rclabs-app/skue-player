# Plano de Continuidade — RC Player (Rumo ao MVP)

**Data da Sessão:** 20 de Outubro de 2026  
**Status do Repositório:** Ramo `main` — sincronizado, containers ativos, testes do backend passando (25/25), build web funcional (Vite/TypeScript sem erros).

---

## 1. O que foi feito nesta sessão

### 1.1 Análise e Recuperação de Contexto
- Revisamos todo o histórico recente de commits e documentação (`docs/CHANGELOG_WEB.md`, `docs/ANALISE_MVP.md`, `ANTIGRAVITY_SPECS.md`).
- Mapeamos a última funcionalidade implementada no código: **Playlist Principal (Main Playlist)** de ponta a ponta (commit `ccaeef4`), com migration no Laravel, endpoints no backend e interface reativa no portal e no app com badge indicativo e troca assistida de lista.

### 1.2 Análise de Estratégia DevOps (Skills do GitLab e Vercel)
- Analisamos a utilidade de skills dedicadas:
  - **Vercel Skill:** Deploys instantâneos de preview da SPA Vue 3 (`web/`), essenciais para testes imediatos no navegador de Smart TVs via URL, monitoramento de logs e gestão segura de variáveis de ambiente.
  - **GitLab Skill:** Automação de pipelines de CI/CD para compilação do APK nativo Android, publicação automatizada dos binários (`.apk`) em releases, gestão de Merge Requests e issues.

### 1.3 Execução e Estabilização dos Ambientes
- Inicialização da stack completa via Docker Compose:
  - **Backend (Laravel + SQLite):** [http://localhost:8000](http://localhost:8000) (Status: `healthy`).
  - **Frontend (Vue 3 + Vite):** [http://localhost:5173](http://localhost:5173) (Status: `online` com HMR).
- Resolução de isolamento de variáveis do shell que apontavam para outro projeto (`sysaga`/MySQL).
- Correção no container do frontend, instalando a dependência ausente `mpegts.js` no volume.

### 1.4 Resolução do Erro de Conexão no Onboarding (CORS / 404)
- **Causa:** O arquivo `web/.env.local` continha `VITE_API_BASE_URL=https://rc-player-production.up.railway.app`, que apontava para um ambiente remoto inativo no Railway (retornando 404 sem CORS).
- **Ações Realizadas:**
  - Desativamos a variável no `web/.env.local` para usar o proxy interno do Vite (`/api`).
  - Atualizamos o componente `web/src/views/OnboardingView.vue` para que o QR Code e o portal usem `${window.location.origin}/portal` dinamicamente.
  - O handshake de ativação (`/api/v1/devices/handshake`) e configuração remota (`/api/v1/devices/{mac}/config`) foram testados e validados com resposta `200 OK`.

---

## 2. Diagnóstico Atual do Projeto

- **Frontend Web:** Totalmente funcional, compilando em 3.6s via `npm run build` com zero erros de tipagem.
- **Backend:** 25 testes automatizados de Feature passando (`DeviceActivationTest`, `PairingTest`, `TMDBControllerTest`).
- **Android TV Bridge:** Código nativo no `MainActivity.java` configurado com `SurfaceView` e WebView transparente para ExoPlayer a 60fps.
- **APK Atual:** O arquivo em `download/rcplayer.apk` é datado de **29 de Agosto de 2026** e precisa ser regerado para incorporar todas as melhorias de Setembro e Outubro.

---

## 3. Checklist e Plano de Ação para Publicar o MVP

Para a próxima sessão, as seguintes tarefas foram priorizadas para a publicação:

### Etapa 1: Atualização e Geração do Novo APK (Android TV)
- [ ] Executar `npx cap sync android` na pasta `web/` com os assets mais recentes compilados (`dist/`).
- [ ] Incrementar a versão no `web/android/app/build.gradle` (ex: `versionCode 8`, `versionName "0.8.0-mvp"`).
- [ ] Compilar o novo APK (`./gradlew assembleRelease` ou `assembleDebug`).
- [ ] Copiar o APK gerado para `download/rcplayer.apk`.
- [ ] Realizar teste prático de instalação e reprodução na TV TCL C6K.

### Etapa 2: Deploy e Infraestrutura de Produção
- [ ] **Deploy do Backend Laravel:** Provisionar instância do backend com SQLite em ambiente estável com HTTPS (Railway, Render, Fly.io ou VPS da RCLabs).
- [ ] **Deploy do Frontend Web:** Conectar o repositório à Vercel (ou Cloudflare Pages) e configurar `vercel.json` com reescrita de rotas para `index.html`.
- [ ] **Variáveis de Ambiente:** Definir `VITE_API_BASE_URL` em `web/.env.production` apontando para o backend hospedado, e cadastrar `TMDB_API_KEY` no backend.

### Etapa 3: Compliance Jurídico e Onboarding
- [ ] Implementar modal inicial obrigatório de **Termos de Uso e Isenção de Responsabilidade Legal** no primeiro boot (consumindo `POST /api/v1/terms/accept`).
- [ ] Incluir e-mail institucional de contato / suporte / DMCA na view de configurações (`SettingsView.vue`).

### Etapa 4: Rebranding e Identidade (Opcional antes da release)
- [ ] Avaliar as 25 sugestões de nomes em `docs/sugestoes_nomes.md` (ex: *Kineo*, *Lumina*, *Nyx*, *Omni Player*, *Flixfy*).
- [ ] Se o nome mudar, atualizar títulos, logos e identificadores antes de fixar o build final.
