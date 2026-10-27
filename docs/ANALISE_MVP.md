# Análise Crítica — Skue MVP (Parte 1)

## 1. Resumo do Produto

**O que é:** Skue é um reprodutor e organizador de mídia local-first. O usuário fornece sua própria fonte M3U/M3U8 e o app organiza e reproduz o conteúdo — TV ao vivo, filmes e séries — sem qualquer catálogo próprio.

**Problema que resolve:** Ausência de um player moderno, bonito e controlável para fontes M3U privadas que funcione tanto no navegador quanto na TV, sem depender de apps genéricos (VLC, IPTV Smarters) com UX ruim ou foco questionável.

**Público-alvo:** Usuário técnico que já possui sua própria fonte de mídia compatível (M3U/M3U8) e quer uma interface limpa para acessá-la no navegador e na TV.

**Plataformas:**
- Navegador web (PWA instalável)
- Android TV / Google TV (APK — testado na TCL C6K)

**Funcionalidades declaradas:**
- Parser M3U local (sem envio ao backend)
- Catálogo: TV ao vivo, filmes, séries, categorias
- Busca local
- Favoritos e histórico (locais)
- Progresso de reprodução
- EPG via XMLTV (opcional)
- Player web (HLS.js + video nativo)
- Player Android (Media3/ExoPlayer)
- Pareamento navegador ↔ TV via código temporário
- Configurações (fonte, EPG, idioma, limpeza)
- Termos de Uso + declaração do usuário
- i18n: PT-BR e EN

**Arquitetura:** Local-first. Backend mínimo — apenas pareamento, health check, aceite de termos e versão do app.

**Fluxo principal:**
1. Navegador: aceite de termos → adiciona fonte M3U → processa localmente → usa o player
2. TV: exibe código de 6 chars → usuário pareia pelo navegador → config transferida uma vez → TV armazena localmente

---

## 2. Classificação das Funcionalidades

### Essenciais para o primeiro MVP
- Parser M3U no navegador (Worker, sem bloqueio da UI)
- Catálogo básico (TV ao vivo, filmes, séries, categorias)
- Player web (HLS.js + video nativo)
- Busca local
- Favoritos e histórico locais (IndexedDB)
- Progresso de reprodução (filmes/séries)
- Tela de termos + declaração + aceite
- Configuração de fonte (URL ou arquivo)
- Backend: health, pairing codes, terms accept
- Pareamento navegador ↔ TV
- App Android TV com parser, catálogo, player e navegação por controle remoto

### Importantes, mas podem entrar depois
- EPG XMLTV (complexidade alta, retorno variável — muitas fontes não têm)
- Skeleton loading elaborado
- i18n completo (PT-BR + EN) — comece só PT-BR
- Configuração de tamanho de interface / formato de tela
- PWA instalável (pode vir após o web funcionar)
- Seleção de áudio e legenda no Android (disponível no ExoPlayer, mas exige UI extra)
- Revogação de dispositivo (backend mais complexo)
- QR Code na tela da TV (útil, mas não bloqueia)
- Temporadas/episódios identificados automaticamente (heurística frágil)

### Desnecessárias ou prematuras
- Redis para MVP (ver seção 6 — SQLite resolve)
- MySQL para MVP (ver seção 6 — SQLite resolve)
- Docker Compose completo no dia 1 (útil, mas não bloqueia o desenvolvimento inicial)
- app_versions como entidade de banco (um .json estático já resolve)
- devices como entidade separada (pode ser derivado do pairing sem tabela própria)
- Suporte a "controle de dispositivos de teste" (vago e não essencial)
- Tela de configuração de idioma (comece PT-BR fixo)
- "Tamanho da interface" e "formato de tela" nas configurações

---

## 3. O Projeto é Realmente Enxuto?

**Excesso de arquitetura:**
- Laravel + MySQL + Redis para 7 endpoints e uma tabela de pareamento é pesado. Um backend Node.js/Hono com SQLite ou até um conjunto de edge functions resolveria com zero infraestrutura de banco.
- A entidade `devices` não tem uso claro no MVP. O documento menciona "controlar dispositivos de teste" mas não define o que isso significa operacionalmente.
- A entidade `app_versions` pode ser um JSON estático servido pelo mesmo servidor — não precisa de tabela.

**Excesso de documentação:**
- 3 arquivos de documentação (PRODUCT.md, ARCHITECTURE.md, LEGAL_AND_SECURITY.md) são razoáveis. Mas o próprio PDF já tem 13 páginas de especificação detalhada — isso é documentação demais antes de uma linha de código.

**Funcionalidades prematuras:**
- EPG XMLTV: parsing de XMLTV é complexo e a maioria das fontes tem EPG ruim ou nenhum. Pode ser fase 2.
- i18n: estruturar para múltiplos idiomas desde o início adiciona camada sem validação de mercado.
- Identificação automática de temporadas/episódios: heurística baseada em nome do grupo/canal é frágil e vai gerar falsos positivos.

**Dependências questionáveis:**
- Redis: se o único uso é TTL nos pairing codes, qualquer banco com `expires_at` e um job de limpeza resolve.
- MySQL: para MVP com 4 tabelas pequenas, SQLite é suficiente e elimina um container.
- Tailwind CSS + Vue 3 + Pinia + Vue Router + HLS.js + TypeScript + Vite: stack razoável, mas é um conjunto grande para um MVP. Cada item tem custo de configuração.

**Complexidade que aumenta manutenção:**
- Jetpack Compose for TV é relativamente novo e documentação ainda é escassa. Aumenta a curva de aprendizado.
- Criptografia do payload de pareamento requer decisão de algoritmo, gerenciamento de chave e implementação nos dois lados (web + Android). Não é trivial.
# Análise Crítica — Skue MVP (Parte 2)

## 4. Viabilidade Técnica por Plataforma

| Plataforma | Viabilidade | Observação |
|---|---|---|
| Navegador web | ✅ Alta | Vue 3 + HLS.js é padrão consolidado |
| PWA instalável | ✅ Alta | Service Worker + manifest — simples |
| Android TV | ✅ Alta | Kotlin + Jetpack Compose TV + ExoPlayer |
| Google TV | ✅ Alta | Mesma base do Android TV |
| Controle remoto | ⚠️ Média | Requer foco e navegação cuidadosos; Compose TV ajuda |
| TCL C6K (Android TV) | ✅ Alta | ExoPlayer lida bem com HLS; testar codecs específicos |
| Listas M3U/M3U8 | ✅ Alta | Parsing é maduro; listas grandes exigem Worker |
| EPG XMLTV | ⚠️ Média | Parsing é complexo; formato tem variações; muitas fontes têm EPG ruim |
| HLS | ✅ Alta (Android) / ⚠️ Média (browser) | Android: ExoPlayer nativo. Browser: HLS.js necessário; CORS pode impedir |
| Armazenamento local web | ✅ Alta | IndexedDB é adequado; limite de 50-80% do disco disponível |
| Armazenamento local Android | ✅ Alta | SharedPreferences + Room/arquivo — padrão estável |
| Pareamento navegador ↔ TV | ⚠️ Média | Requer backend ativo e criptografia end-to-end; não é trivial |

---

## 5. Diferenças e Limitações Navegador vs. Android TV

### CORS
- **Navegador:** CORS bloqueia completamente streams de origens sem cabeçalho adequado. Não há contorno legítimo.
- **Android TV:** ExoPlayer faz requisições nativas de rede — sem CORS. Streams que falham no navegador funcionam no Android.
- **Consequência prática:** O mesmo M3U pode reproduzir 100% no Android e 20% no navegador. Isso deve ser comunicado claramente ao usuário. O documento já prevê essa mensagem — correto.

### Codecs e formatos
- **Navegador:** Suporte limitado a H.265/HEVC (apenas Safari em hardware específico). H.264 + AAC funciona amplamente. VP9/AV1 variável.
- **Android TV/TCL C6K:** H.264 e H.265 com decodificação de hardware — muito mais amplo.
- **Impacto:** Streams HEVC comuns em fontes M3U vão falhar silenciosamente no navegador.

### Autenticação das fontes
- **Navegador:** URLs com usuário/senha (ex: `http://user:pass@host/`) são bloqueadas por browsers modernos. Tokens na query string funcionam, mas ficam visíveis nos logs.
- **Android:** Retrofit + OkHttp permitem autenticação customizada sem restrições do browser.

### Reprodução HLS
- **Navegador:** HLS nativo só no Safari. Chrome/Firefox precisam do HLS.js, que usa Media Source Extensions (MSE). MSE não funciona em todos os ambientes (ex: alguns iframes, algumas TVs com browser limitado).
- **Android:** ExoPlayer tem suporte nativo completo a HLS, incluindo chaves de criptografia AES-128.

### Desempenho com listas grandes
- **Ambos:** Listas M3U com 10.000+ entradas precisam ser processadas em Web Worker (web) ou coroutine/thread (Android). Parsing síncrono trava a UI.
- **Virtualização de lista:** No web, listas muito grandes precisam de virtual scroll. Vue sem virtualização vai renderizar todos os itens e travar.
- **O documento menciona** processamento sem bloquear a interface (Worker) — correto. Mas não menciona virtual scroll, que é igualmente importante.

### Armazenamento local — limitações
- **IndexedDB (web):** Sem cota fixa; browsers pedem permissão ao usuário quando ultrapassa ~50MB. Dados podem ser limpos pelo browser ("limpar cache"). Não persistente de forma garantida.
- **Android (SharedPreferences / Room / arquivo):** Mais persistente, mas ainda pode ser apagado na limpeza de dados do app.
- **Consequência:** Usuário pode perder toda a configuração sem aviso. O documento menciona "limpeza completa" como feature — mas não menciona a necessidade de export/backup da config.

### Navegação por controle remoto
- **Composables de foco** no Jetpack Compose TV precisam ser explicitamente configurados. Sem isso, o foco fica preso ou pula de forma imprevisível.
- **Scroll em listas grandes** com controle remoto precisa de paginação ou virtualização — listas infinitas travam.
- **Modal e overlay** precisam de tratamento especial de foco para não "perder" o usuário.

---

## 6. Avaliação da Arquitetura Local-First

### O que realmente precisa do backend
- Geração e validação de pairing codes (TTL, uso único, limite de tentativas)
- Armazenamento temporário do payload criptografado
- Registro do aceite de termos (versão aceita + timestamp)
- Health check

### O que deve ficar somente no dispositivo
- Todo o catálogo M3U
- Favoritos e histórico
- Progresso de reprodução
- Configuração da fonte (URL, credenciais)
- EPG parseado

### O backend Laravel pode ser mais simples?
**Sim.** Para 4-7 endpoints com lógica mínima, as alternativas são:

| Opção | Vantagem | Desvantagem |
|---|---|---|
| Laravel (atual) | Familiar, completo | Pesado para esse escopo; exige PHP + Composer |
| Node.js + Hono/Fastify | Leve, deploy simples | Diferente do stack atual do time |
| Python + FastAPI | Simples e rápido | Diferente do stack |
| Laravel com SQLite | Mesma stack, sem MySQL | Menos comum em prod, mas funciona |

**Recomendação:** Manter Laravel se o time conhece PHP, mas **trocar MySQL por SQLite** no MVP. Menos um container, zero configuração de banco.

### Redis é necessário no início?
**Não.** O único uso declarado é TTL dos pairing codes.

Alternativa sem Redis:
```sql
pairing_codes (
  code VARCHAR(6) PRIMARY KEY,
  payload TEXT,
  expires_at TIMESTAMP,
  consumed_at TIMESTAMP NULL,
  attempts INT DEFAULT 0
)
```
Um job agendado (ou limpeza on-demand) remove os expirados. Sem Redis, sem container extra.

### MySQL é necessário no início?
**Não.** Com SQLite:
- Zero configuração
- Zero container extra
- Laravel suporta nativamente (`DB_CONNECTION=sqlite`)
- Suficiente para o volume do MVP

### Pareamento — como fazer de forma simples e segura
O documento descreve criptografia do payload. A questão é: **qual chave, gerada por quem?**

Opção mais simples e segura:
1. TV gera o código de 6 chars e um **par de chaves efêmeras** (ou uma chave simétrica aleatória)
2. TV envia ao backend: código + chave pública (ou chave simétrica criptografada com HTTPS)
3. Navegador busca o código → recebe a chave pública
4. Navegador criptografa o payload com a chave pública → envia ao backend
5. TV consome → descriptografa com chave privada → apaga do backend

Isso garante que mesmo o backend não lê o payload. Mas exige cripto no Android e no web — complexidade real.

**Alternativa MVP:** HTTPS já criptografa o transporte. O payload some em 10 minutos. Para um MVP, isso pode ser suficiente sem cripto end-to-end adicional. Decidir e documentar.

---

## 7. Análise das Medidas Jurídicas e Operacionais

### O que o documento faz bem
- Reconhece explicitamente que os termos são **minutas** que precisam de advogado
- Exige declaração ativa do usuário (não checkbox pré-marcado)
- Proíbe linguagem de marketing enganosa ("TV grátis", "canais liberados")
- Veda o uso do nome "Netflix" em qualquer contexto
- Mantém o backend sem contato com o conteúdo do usuário
- Remove URLs dos logs
- Mascara credenciais em erros

### Riscos que o documento não elimina

**Risco 1 — Natureza da fonte do usuário**
O sistema é tecnicamente neutro, mas o público provável são usuários de IPTV pirata. A declaração de que "o usuário possui autorização" é uma proteção contratual fraca se o uso real for consistentemente ilegal. Plataformas de streaming e titulares de direitos têm histórico de processar o desenvolvedor do player, não apenas o usuário.

**Risco 2 — Forma de distribuição**
Publicar na Google Play aumenta dramaticamente a visibilidade e o risco. A Google pode remover o app por violação das políticas mesmo sem processo judicial. Distribuição via APK sideload tem menos visibilidade e menos risco de remoção, mas alcance menor.

**Risco 3 — Textos jurídicos gerados sem revisão**
Os textos de termos e políticas gerados por IA ou template são insuficientes para proteção real. O documento reconhece isso, mas o risco de publicar antes da revisão existe.

**Risco 4 — Canal de denúncias**
O documento exige um canal de denúncias, mas não define quem responde, em qual prazo e com qual processo. Um canal que não funciona na prática pode ser usado contra o produto.

**Risco 5 — Nomeação do produto**
"Skue" é genérico e provavelmente livre. Mas antes de publicar, verificar no INPI (Brasil) e no USPTO se há marcas conflitantes.

### Diferenciando as proteções
| Tipo | O que o documento faz |
|---|---|
| **Proteção técnica** | Boa: backend não toca no conteúdo, sem proxy, sem catálogo próprio |
| **Proteção contratual** | Razoável: declaração do usuário, termos marcados como minuta |
| **Proteção operacional** | Incompleta: canal de denúncias sem processo definido |
| **Proteção jurídica real** | Requer advogado especializado — o documento é honesto sobre isso |

### Funcionalidades que aumentam o risco
- **QR Code na TV apontando para um domínio específico:** se o domínio for associado ao produto publicamente, aumenta a superfície de ataque jurídico.
- **EPG XMLTV:** exibir grade de programação de emissoras pode configurar uso de dados protegidos dependendo da fonte.
- **Publicação na Google Play:** aumenta exposição e risco de remoção.
# Análise Crítica — Skue MVP (Parte 3)

## 8. Requisitos Problemáticos

### Requisitos contraditórios
| Contradição | Descrição |
|---|---|
| "MVP enxuto" vs. stack completo | O documento pede MVP enxuto mas define Laravel+MySQL+Redis+Vue3+TypeScript+Pinia+Tailwind+Android+Kotlin — duas plataformas desde o dia 1 |
| "local-first" vs. "criptografia end-to-end no pareamento" | Se tudo é local, por que adicionar cripto complexa no único ponto de passagem pelo backend? |
| "uma fonte por instalação" vs. "configurações cadastradas localmente no navegador" (plural) | O pareamento menciona "selecionar uma configuração já cadastrada localmente" — sugere múltiplas configs |
| "sem reprodução automática" vs. "controle de reprodução automática ao selecionar canal" nas configurações | TV ao vivo normalmente reproduz ao selecionar — a opção de configuração pressupõe comportamento conflitante |

### Requisitos vagos
- **"Controlar dispositivos de teste":** O backend deve fazer o quê exatamente? Aprovar? Bloquear? Listar? Não está definido.
- **"Suportar futuramente o licenciamento":** Não há nenhum detalhe de como isso afeta a estrutura atual.
- **"Tipo de conteúdo" no parser:** Como identificar se é live/filme/série sem metadados explícitos? Qual heurística? A partir de qual campo?
- **"Temporadas e episódios quando puderem ser identificados com segurança":** O critério de "segurança" não está definido.
- **"Destaque visual neutro" na página inicial:** O que é um destaque "neutro"? Banner sem autoplay? Card estático? Precisa de decisão de design.
- **"Próximo episódio manual":** O usuário clica? Há uma tela de seleção? Não está especificado.

### Requisitos impossíveis ou de alto risco
- **"Não permitir enumeração previsível" para código de 6 chars:** Com o alfabeto definido (sem O, 0, I, 1), restam ~30 chars → ~30^6 ≈ 729 milhões de combinações. Com rate limiting de 5 tentativas, a enumeração é inviável na prática. Mas "não permitir enumeração previsível" é uma afirmação forte — o gerador deve usar CSPRNG, o que o documento já exige.
- **"Identificar temporadas e episódios com segurança" a partir de M3U:** M3U não tem campos estruturados para isso. Qualquer heurística baseada em nome vai ter taxa de erro alta.

### Pontos que podem causar retrabalho
1. **Criptografia do pareamento:** Se o MVP for com HTTPS simples e depois migrar para E2E, o Android e o web precisam ser reescritos nessa parte.
2. **IndexedDB schema:** Se o schema mudar após dados reais, migração é complexa. Planejar versioning desde o início.
3. **Parser M3U compartilhado:** O documento propõe um parser "compartilhável por testes" — mas web (TypeScript) e Android (Kotlin) são linguagens diferentes. O parser não pode ser literalmente compartilhado. Precisa ser implementado duas vezes.
4. **Virtual scroll:** Se não for implementado desde o início, listas grandes vão exigir refatoração completa da lista.
5. **EPG:** Se o XMLTV for integrado depois, a estrutura do catálogo no IndexedDB precisará ser estendida.

### Riscos técnicos
| Risco | Probabilidade | Impacto |
|---|---|---|
| Streams HEVC falham no browser | Alta | Médio — comunicar ao usuário |
| CORS bloqueia maioria dos streams no browser | Alta | Alto — o app pode parecer quebrado |
| TCL C6K com Android TV antigo sem suporte a Compose TV | Média | Alto — pode exigir fallback para View |
| Listas M3U muito grandes (50k+ entradas) travam | Alta | Alto — exige Worker + virtual scroll |
| EPG XMLTV com formato não padrão | Alta | Médio — parser deve ser tolerante a falhas |
| Foco perdido na TV durante modais | Média | Alto — UX inaceitável no controle remoto |

### Riscos de publicação na Google Play
- Apps de player IPTV genérico são removidos com frequência por violação da política de conteúdo (seção 4.4 da Google Play Developer Policy)
- A Google pode interpretar o app como facilitador de pirataria mesmo com disclaimers
- Alternativa mais segura para MVP: **distribuição via APK direto** (sideload) — sem exposição pública, sem risco de remoção, adequado para fase de testes na TCL C6K

### Riscos de manutenção
- Duas plataformas (web + Android) desde o início dobram o esforço de manutenção
- HLS.js tem atualizações frequentes com breaking changes ocasionais
- Jetpack Compose TV ainda evolui rapidamente — APIs podem mudar entre versões
- Laravel com versões de PHP exige atualizações periódicas de segurança

---

## 9. Menor Versão Funcional Possível (Micro-MVP)

Mantendo: layout moderno, boa experiência no navegador, boa experiência na TV, reprodução, categorias, busca, favoritos, histórico, progresso, pareamento, configuração da fonte, termos.

### Web
- Tela de boas-vindas + termos + aceite
- Campo para adicionar URL M3U ou arquivo
- Parser M3U em Web Worker
- Catálogo com 4 tabs: TV ao vivo / Filmes / Séries / Categorias
- Busca local (sem backend)
- Favoritos (IndexedDB)
- Histórico e progresso (IndexedDB)
- Player: `<video>` + HLS.js com fallback nativo
- Tela de pareamento: digitar código → enviar config para TV
- Configurações: editar/remover fonte, limpar dados, ver termos

### Android TV
- Tela inicial com termos resumidos
- Código de pareamento de 6 chars na tela
- QR Code com URL de pareamento
- Catálogo local (após pareamento)
- Player ExoPlayer com HLS
- Navegação completa por D-pad
- Favoritos e histórico locais

### Backend (SQLite, sem Redis, sem MySQL)
```
GET  /api/v1/health
POST /api/v1/pairing-codes
GET  /api/v1/pairing-codes/{code}
POST /api/v1/pairing-codes/{code}/payload
POST /api/v1/pairing-codes/{code}/consume
POST /api/v1/terms/accept
GET  /api/v1/app-version  ← pode ser JSON estático
```

### O que fica de fora do Micro-MVP
- EPG XMLTV
- i18n (começa PT-BR fixo)
- Identificação automática de séries/temporadas
- Seleção de áudio e legenda (Android)
- QR Code (pode ser texto simples primeiro)
- PWA manifest/Service Worker (vem depois)
- Configurações de tamanho de interface
- Criptografia E2E no payload (HTTPS é suficiente para MVP)
- Revogação de dispositivo

---

## 10. Ordem de Implementação em Etapas Testáveis

### Etapa 1 — Backend mínimo (testável: Insomnia/Postman)
- Laravel + SQLite
- Tabelas: `pairing_codes`, `terms_acceptances`
- Endpoints: health, pairing (create/get/consume), terms/accept
- Sem Redis, sem MySQL
- Rate limiting básico
- Testes unitários: expiração, uso único, limite de tentativas

### Etapa 2 — Parser M3U (testável: testes unitários)
- Classe TypeScript para parsing M3U
- Roda em Web Worker
- Suporta: #EXTINF, group-title, tvg-logo, tvg-id
- Testes com M3U sintético: válido, inválido, vazio, gigante

### Etapa 3 — Web: onboarding + fonte (testável: navegador)
- Tela de termos com aceite explícito
- Tela de configuração de fonte (URL + arquivo)
- Parser executado → catálogo salvo no IndexedDB
- Navegar entre categorias (sem player ainda)

### Etapa 4 — Web: player (testável: navegador com fonte real)
- `<video>` + HLS.js
- Reprodução de stream ao clicar no item
- Mensagem clara quando CORS bloqueia
- Favoritos e histórico funcionando

### Etapa 5 — Web: busca e progresso (testável: navegador)
- Busca local por nome
- Progresso salvo ao pausar/sair
- "Continuar assistindo" na home

### Etapa 6 — Android TV: estrutura e UI (testável: emulador Android TV)
- Projeto Kotlin + Compose TV
- Tela de termos
- Tela de pareamento com código e URL
- Catálogo vazio (aguardando pareamento)
- Navegação D-pad funcional

### Etapa 7 — Pareamento (testável: navegador + TV em paralelo)
- Navegador: digita código → envia config para backend
- Android: consome payload do backend → salva config localmente
- Backend: apaga payload após consumo

### Etapa 8 — Android: catálogo e player (testável: TCL C6K)
- Parser M3U em coroutine
- Catálogo com categorias
- Player ExoPlayer + HLS
- Favoritos locais
- Teste físico na TCL C6K

### Etapa 9 — Busca e histórico no Android (testável: TCL C6K)
- Busca local por D-pad
- Histórico e progresso

### Etapa 10 — Polimento e segurança (testável: revisão de código)
- CSP no web app
- Validação de URLs (bloquear esquemas perigosos)
- Logs sem URLs/credenciais
- Limite de tamanho de arquivo M3U
- Testes E2E mínimos

### Etapa 11 — Documentação final
- README com instruções de instalação do APK na TCL C6K
- README do web app
- LEGAL_AND_SECURITY.md marcado como minuta
- Somente documentação que corresponde ao que foi implementado

---

## 11. Estrutura Mínima de Pastas

```
skue-player/
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/
│   │   │   ├── HealthController.php
│   │   │   ├── PairingController.php
│   │   │   └── TermsController.php
│   │   └── Models/
│   │       ├── PairingCode.php
│   │       └── TermsAcceptance.php
│   ├── routes/api.php
│   ├── tests/Feature/
│   │   └── PairingTest.php
│   └── database/migrations/
│
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── player/
│   │   │   ├── catalog/
│   │   │   └── pairing/
│   │   ├── composables/
│   │   ├── stores/          ← Pinia
│   │   ├── views/
│   │   │   ├── HomeView.vue
│   │   │   ├── LiveView.vue
│   │   │   ├── MoviesView.vue
│   │   │   ├── SeriesView.vue
│   │   │   ├── SearchView.vue
│   │   │   ├── SettingsView.vue
│   │   │   └── OnboardingView.vue
│   │   ├── workers/
│   │   │   └── m3u-parser.worker.ts
│   │   ├── lib/
│   │   │   ├── m3u-parser.ts
│   │   │   ├── indexeddb.ts
│   │   │   └── player.ts
│   │   └── router/
│   └── tests/
│
├── android-tv/
│   └── app/src/main/
│       ├── java/tv/skue/player/
│       │   ├── ui/
│       │   │   ├── home/
│       │   │   ├── player/
│       │   │   ├── pairing/
│       │   │   └── settings/
│       │   ├── data/
│       │   │   ├── local/
│       │   │   └── remote/
│       │   └── parser/
│       │       └── M3UParser.kt
│       └── res/
│
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   └── LEGAL_AND_SECURITY.md    ← marcado como minuta
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```
# Análise Crítica — Skue MVP (Parte 4)

## 12. Tabela de Decisões

| Item | Decisão recomendada | Manter no MVP | Adiar | Remover | Motivo |
|---|---|---|---|---|---|
| Laravel + PHP | Manter se o time conhece | ✅ | — | — | Familiar, mas considerar simplificações |
| MySQL | Substituir por SQLite | — | — | ✅ | 4 tabelas pequenas não justificam MySQL no MVP |
| Redis | Remover do MVP | — | ✅ | — | Coluna `expires_at` + job de limpeza resolve |
| Docker Compose | Simplificar (sem MySQL/Redis) | ✅ | — | — | Facilita onboarding |
| Vue 3 + Vite + TypeScript | Manter | ✅ | — | — | Stack sólido, adequado |
| Tailwind CSS | Manter | ✅ | — | — | Produtividade |
| Pinia | Manter | ✅ | — | — | Gerenciamento de estado necessário |
| HLS.js | Manter | ✅ | — | — | Necessário para HLS no browser |
| IndexedDB | Manter | ✅ | — | — | Único mecanismo adequado para dados locais no browser |
| PWA (manifest + SW) | Adiar | — | ✅ | — | Não bloqueia validação do produto |
| EPG XMLTV | Adiar | — | ✅ | — | Complexidade alta, dependência de fonte boa |
| i18n (EN + PT-BR) | PT-BR fixo no MVP | — | ✅ | — | Estruturar para expansão, não implementar EN agora |
| Kotlin + Compose TV | Manter | ✅ | — | — | Stack correto para Android TV |
| Media3/ExoPlayer | Manter | ✅ | — | — | Padrão Android para HLS |
| Retrofit | Manter | ✅ | — | — | Necessário para pareamento |
| Parser M3U compartilhado | Implementar separado em cada plataforma | ✅ | — | — | Web e Android têm linguagens diferentes |
| Criptografia E2E no pareamento | Adiar — HTTPS basta no MVP | — | ✅ | — | Complexidade real sem ganho imediato num MVP |
| Virtual scroll na lista | Implementar desde o início | ✅ | — | — | Sem isso, listas grandes travam |
| Web Worker para parser | Implementar desde o início | ✅ | — | — | Sem isso, parsing trava a UI |
| QR Code na TV | Adiar — texto simples primeiro | — | ✅ | — | URL + código de 6 chars é suficiente para MVP |
| Entidade `devices` no backend | Remover ou simplificar | — | — | ✅ | Uso não claro no MVP; pairing_codes já identifica a TV |
| Entidade `app_versions` no banco | Substituir por JSON estático | — | — | ✅ | Não precisa de banco |
| "Controlar dispositivos de teste" | Definir ou remover | — | — | ✅ | Requisito vago sem implementação definida |
| Identificação automática séries/temporadas | Adiar | — | ✅ | — | Heurística frágil — muitos falsos positivos |
| Reprodução automática (live) | Implementar como padrão, toggle nas settings | ✅ | — | — | Contradição do doc: resolver com padrão ligado |
| Seleção de áudio e legenda (Android) | Adiar | — | ✅ | — | ExoPlayer suporta, mas a UI adiciona complexidade |
| Revogação de dispositivo | Adiar | — | ✅ | — | Não essencial para validação do produto |
| Canal de denúncias | Implementar como link/email | ✅ | — | — | Necessário por medida operacional; não precisa ser complexo |
| Termos de Uso / Política de Privacidade | Implementar como minuta | ✅ | — | — | Obrigatório antes de qualquer publicação |
| Publicação na Google Play | Adiar — distribuir APK direto no MVP | — | ✅ | — | Reduz risco jurídico e de remoção durante validação |
| CSP no web app | Implementar | ✅ | — | — | Segurança básica |
| Mascaramento de credenciais nos logs | Implementar | ✅ | — | — | Medida obrigatória |
| Rate limiting no pareamento | Implementar | ✅ | — | — | Anti-enumeração |
| Validação e bloqueio de esquemas perigosos | Implementar | ✅ | — | — | Segurança básica |
| Skeleton loading | Implementar | ✅ | — | — | UX mínima aceitável |
| Configuração de tamanho de interface | Remover do MVP | — | — | ✅ | Prematura — não há evidência de necessidade |
| Ajuste de formato de tela | Remover do MVP | — | — | ✅ | Prematura |

---

## 13. Decisões que Precisam da Aprovação do Responsável

Estas são as únicas decisões que realmente **impedem o início do desenvolvimento** e precisam de resposta antes de qualquer linha de código.

---

### Decisão 1 — Banco de dados do backend
**Pergunta:** O backend usará MySQL + Redis (como o documento especifica) ou SQLite (sem Redis), suficiente para o MVP?

- **MySQL + Redis:** Mais próximo do documento original. Exige configuração de 3 containers Docker. Custo de operação maior.
- **SQLite:** Zero containers extras. Zero configuração de banco. Suficiente para o volume do MVP. Pode migrar para MySQL depois.

> **Recomendação:** SQLite no MVP. Mas precisa de confirmação explícita.

---

### Decisão 2 — Criptografia do payload de pareamento
**Pergunta:** O payload transferido durante o pareamento será:
- (a) Protegido apenas pelo HTTPS (transporte) — mais simples, adequado para MVP
- (b) Criptografado end-to-end (chave gerada na TV, payload ilegível mesmo para o backend) — mais seguro, mais complexo

> **Recomendação:** Opção (a) no MVP. Mas a decisão impacta tanto o Android quanto o web, e não pode ser alterada sem retrabalho.

---

### Decisão 3 — Publicação na Google Play vs. APK direto
**Pergunta:** Para a fase de MVP/testes:
- (a) Distribuição via APK direto (sideload) — sem risco de remoção, sem exposição pública
- (b) Publicação na Google Play — mais visibilidade, mais risco de remoção por política

> **Recomendação:** APK direto no MVP. Mas precisa de confirmação, pois afeta como o README de instalação será escrito.

---

### Decisão 4 — Plataforma única ou duas simultâneas
**Pergunta:** O desenvolvimento começará com:
- (a) Web primeiro — valida o conceito com menor esforço; Android depois
- (b) Web + Android simultaneamente — dobra o esforço inicial mas entrega as duas plataformas juntas

> **Recomendação:** Web primeiro, Android na sequência imediata. Mas se há prazo ou recurso restrito, isso precisa ser definido agora.

---

### Decisão 5 — Revisão jurídica antes ou depois do MVP
**Pergunta:** Os textos de Termos de Uso e Política de Privacidade serão:
- (a) Gerados como minuta para o MVP e revisados por advogado antes da publicação pública
- (b) Revisados por advogado antes mesmo do primeiro teste

> **Recomendação:** Minuta no MVP (fase fechada de testes). Revisão obrigatória antes de qualquer distribuição pública.

---

### Decisão 6 — Domínio e identidade do produto
**Pergunta:** O nome "Skue" e o domínio associado estão definidos e disponíveis?

Isso afeta:
- O QR Code exibido na TV
- A URL de pareamento
- A descrição nos termos
- O nome do pacote Android (`tv.skue.player` ou outro)

> **Recomendação:** Confirmar antes de começar o Android, pois o package name não pode mudar depois da instalação sem reinstalação.

---

## 8. Status de Execução e Documentação (Até o momento)

Até o atual estágio do desenvolvimento, concluímos de forma madura a Etapa Web e Local-First, atingindo um visual e funcionalidade "Premium" (estilo Netflix/Prime).

### O que já foi concluído com sucesso:
1. **Estrutura Local-First (IndexedDB):**
   - O aplicativo baixa e processa listas M3U gigantestas inteiramente no navegador do cliente, sem sobrecarregar o backend.
   - Refatoração de performance (Batching): O salvamento no IndexedDB foi particionado em lotes de 5000 itens, impedindo travamentos severos (`Internal Server Error` ou Out-Of-Memory) em navegadores fracos de Smart TVs (TCL, etc).
   
2. **Inteligência do Parser M3U (`m3u-parser.ts`):**
   - Heurísticas avançadas com Regex identificam corretamente o que é Filme, Série e TV Ao Vivo.
   - Extração do Ano de lançamento do título.
   - Limpeza e deduplicação de nomes de séries (removendo "S01 E01", por exemplo) para que o catálogo de séries mostre apenas a obra principal, agrupando as temporadas dentro da página de detalhes.

3. **Interface e UX Premium (Vue 3 + Tailwind):**
   - Construção de rotas separadas: `HomeView`, `MoviesView`, `SeriesView`, `SearchView` e `DetailsView`.
   - **DetailsView (Landing Page de Conteúdo):** O usuário não é jogado no vídeo direto. Ele entra em uma página de detalhes com sinopse, capa expansiva e abas separadas por Temporadas.
   - Lógica Inteligente de Reprodução: Ao clicar em "Assistir Agora" numa série, o sistema encontra automaticamente o Episódio 1 da Temporada 1 para iniciar a maratona.
   - Design System Premium: Utilização de `mask-image` nos *Hero Banners* para criar um fade suave (esfumaçado) nas bordas das capas. 
   - Grid Imutável: Cálculo de larguras exatas via `calc()` para manter perfeitamente 6 capas (posters em formato 2:3) por linha.
   - Viewport Fixo: Aplicação de `<meta name="viewport" content="width=1920">` para impedir que navegadores de TV apliquem zooms móveis indesejados.

### Próximos Passos (Plano Atualizado):
1. **Empacotamento Android TV (APK):**
   - O uso via "Navegador da Smart TV" (como o BrowseHere) é limitado por restrições dos fabricantes (falsificações de viewport, limitação de memória, heurísticas próprias).
   - O próximo grande marco arquitetural é envelopar essa Web App primorosa dentro de um WebView do Android TV (via Capacitor/Cordova ou Kotlin + Webview) habilitando o `setUseWideViewPort(true)`. Isso resolverá definitivamente qualquer zoom indesejado e entregará a real experiência de "Aplicativo de TV".
2. **Integração do Player (HLS.js):**
   - Acoplar o motor de vídeo (HLS.js / ExoPlayer) para lidar de forma robusta com as URLs de stream que foram parseadas.
3. **Módulo de Pareamento (Backend Laravel):**
   - Construir o fluxo do código de 6 dígitos para linkar a TV ao celular sem digitação de URLs longas.
