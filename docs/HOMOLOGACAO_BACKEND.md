# Backend de homologação

Estado atual: backend e player publicados nos domínios finais com HTTPS válido em 14/11/2026. Veja as seções finais para resultados e próximos passos. As seções anteriores preservam o histórico da preparação.

Preparação local em 14/11/2026. Nenhum recurso da Vercel/Neon, DNS ou ambiente remoto foi criado nesta etapa. O objetivo é testar o protótipo nas franquias gratuitas; não há garantia de custo zero com uso crescente nem aprovação de uso comercial do Hobby.

## O que foi preparado

- `backend/Dockerfile.vercel`: imagem PHP 8.3/Apache, extensões PostgreSQL e dependências de produção pelo lockfile, assets Laravel/Filament e build Vite. O Dockerfile/Compose de desenvolvimento permanecem disponíveis.
- `backend/.dockerignore`: entradas limitadas ao código/build; ambientes, bancos locais, backups, APKs, assinaturas, vendor/node_modules locais e caches antigos não entram na imagem. A imagem não recebe dados da instalação local.
- `backend/docker/start.sh`: valida ambiente, prepara somente diretórios descartáveis em `/tmp` e inicia Apache na porta `PORT` (8080 por padrão). Pode executar um comando explícito de release no lugar do servidor.
- `backend/docker/check-environment.php`: recusa ambiente diferente de production, debug, URL pública sem HTTPS, chave inválida/ausente, driver diferente de pgsql ou conexão sem exigência de TLS. Não imprime os valores e não gera chaves ou acessa banco.
- `backend/config/admin.php` e `User::canAccessPanel()`: fora de `local`, o painel admin exige e-mail exato na lista `SKUE_ADMIN_EMAILS`. Lista vazia nega acesso. O acesso de desenvolvimento local permanece como antes. Não há autorização por domínio de e-mail nem liberação automática de usuário novo.

Configuração pgsql já existia no Laravel e foi preservada; não há necessidade de substituir o SQLite do desenvolvimento. Sessões/cache ficam no banco e a fila desta imagem usa `sync`; inventariar jobs antes de ativar qualquer fila assíncrona.

## Variáveis para o próximo passo

Modelo sem credenciais: `backend/docker/homologation.env.example`. Preencher no gerenciador de segredos da hospedagem, nunca no Git ou nos registros de IA:

- `APP_URL`: HTTPS do backend de homologação, inicialmente endereço fornecido pela Vercel.
- `APP_KEY`: gerar uma vez para a homologação e guardar de forma privada; manter igual em todo redeploy e instância. Não reutilizar chaves/dados da instalação local.
- `DB_CONNECTION=pgsql` e `DB_URL`: URL da base isolada Neon com TLS, ou parâmetros separados `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` e `DB_PORT`. Usar `DB_SSLMODE=require` ou modo de verificação mais forte compatível com o provedor. URL com `sslmode=disable` é recusada mesmo se a variável separada exige TLS.
- `SKUE_ADMIN_EMAILS`: e-mails exatos das contas administrativas realmente criadas, separados por vírgula. Ainda não há responsável configurado por esta tarefa. Alterar essa lista exige atualizar o ambiente e publicar novamente; não alterar código para autorizar alguém.
- Manter `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_DRIVER=database`, `CACHE_STORE=database`, `SESSION_SECURE_COOKIE=true`, `QUEUE_CONNECTION=sync` e logs em stderr.

A chave da aplicação, URL de banco, senha e tokens não são variáveis `VITE_*`. As credenciais do banco devem ser fornecidas diretamente no provedor; não colar segredos no chat. Para conexão com pooler, conferir limites de conexão e orientações do provedor; migrations podem usar endpoint direto do mesmo banco quando necessário.

## Build e inicialização

Na raiz do repositório:

```sh
docker build -f backend/Dockerfile.vercel -t skue-homologacao backend
```

A futura configuração Vercel deve usar a raiz `backend/` e o preset Container, reconhecendo `Dockerfile.vercel`. Isso ainda não foi testado na plataforma; validar disponibilidade/configuração na conta antes de publicar. Não importar a raiz inteira como se fosse uma aplicação única.

A imagem exige um banco PostgreSQL previamente criado. Após configurar seu ambiente privado, aplicar as migrations como passo explícito e único de release, em executor confiável com acesso ao mesmo banco. Não executar `migrate:fresh`, `db:wipe`, seeds de demonstração ou migrações de credenciais sobre dados reais para esse teste inicial.

Exemplo de comandos, usando um arquivo privado **fora do repositório/contexto Docker**, em um caminho escolhido pelo operador:

```sh
docker run --rm --env-file /caminho/privado/homologacao.env \
  skue-homologacao php artisan migrate --force --no-interaction

docker run --rm --read-only --tmpfs /tmp:rw,nosuid,size=128m \
  --env-file /caminho/privado/homologacao.env \
  -p 127.0.0.1:8080:8080 skue-homologacao
```

O arquivo precisa apontar à base exclusiva de homologação e ter permissões restritas. O comando de migration é separado do start do HTTP: nenhuma migration é executada a cada instância ou requisição. A imagem também não contém o banco SQLite local, não gera `APP_KEY` no início e não roda seeds.

Para criar a conta de administração, após banco/configuração prontos, executar interativamente `php artisan make:filament-user` na mesma imagem/ambiente, com credenciais definidas pelo responsável e sem registrar senha em linha de comando. Autorizar o e-mail exato em `SKUE_ADMIN_EMAILS`; criar a conta por si só não concede acesso fora de local. Os usuários desta tabela são operadores administrativos; não confundir com autenticação de clientes por dispositivo.

Não executar `config:cache` no build com dados provisórios. A imagem inclui os manifests de pacotes necessários; views e arquivos descartáveis são escritos em `/tmp` em runtime. A existência de `/tmp` não fornece armazenamento durável: não usar esse local para banco, APK definitivo ou backups de credenciais. A conversão de credenciais exige a operação de backup durável descrita em `OPERACAO_CREDENCIAIS.md`, fora deste teste de base nova.

## Verificações e limites

A tarefa valida build Docker e fluxos locais usando bancos/credenciais fictícios e TLS em PostgreSQL temporário. O ensaio HTTP simula o trecho interno após terminação HTTPS; não é validação de certificado/domínio público nem inspeção visual em navegador.

A base Neon existente foi vinculada na etapa seguinte, conforme atualização abaixo. Os próximos passos ainda precisam criar o projeto Vercel de homologação, definir os demais segredos, configurar CORS/hosts do player e APK, validar limites da plataforma, testar Filament/Livewire em navegador e só então conectar DNS. Restrições do proxy de listas, armazenamento de artefatos/backups e audiência do beta seguem pendentes no plano. Nenhum destes pontos é substituído por HTTP 200 em `/health`.

Referências consultadas: [Container Runtime Vercel](https://vercel.com/docs/functions/runtimes/container), [Laravel com Neon](https://neon.com/docs/guides/laravel), [autorização de usuários Filament 3](https://filamentphp.com/docs/3.x/panels/users).

Validação local concluída: imagem construída; suíte de 73 testes/559 asserções aprovada em SQLite e PostgreSQL 16 com TLS; ensaio HTTP na imagem somente leitura confirmou páginas/assets e fluxo de dispositivo/portal/configuração, inclusive em nova instância com o mesmo banco/chave. Containers e dados fictícios foram removidos após os testes. Isso não comprova execução na Vercel ou conexão com Neon.

## Atualização — conexão Neon existente

Em 14/11/2026, executado o guia oficial `neon init` para o projeto/organização indicados pelo usuário, sem criar outro projeto. A CLI autenticada vinculou o diretório em `.neon` (ignorado no Git) e preencheu `.env` da raiz com `DATABASE_URL` e `DATABASE_URL_UNPOOLED`. Esses arquivos não devem ser versionados nem expostos em logs.

Como o Laravel usa `DB_URL`, as conexões foram adaptadas para **`backend/.env.homologation`**, arquivo privado ignorado no Git e com permissão 0600:

- `DB_URL`: conexão com pool para o runtime.
- `DB_URL_UNPOOLED`: conexão direta disponível para o executor de release; não é usada automaticamente pelo Laravel. Quando necessário, fornecê-la como `DB_URL` somente naquele comando de manutenção, preservando o runtime com pool.
- Driver PostgreSQL e TLS obrigatório mantidos.

O `.env` de desenvolvimento em `backend/` foi preservado byte a byte. A conexão de homologação não substitui o SQLite local. O arquivo privado deriva do template; APP_KEY, APP_URL efetiva e administradores ainda precisam ser definidos antes de iniciar a imagem ou publicar. A Vercel ainda não recebeu nenhuma variável nesta tarefa, pois seu projeto não foi criado.

Verificação real executada: `SELECT 1` por meio do Laravel para ambas as conexões, sem leitura de tabelas de clientes, migrations, seeds ou alteração de esquema. Endpoint público com certificado válido e TLS 1.3 conferido; configuração de banco exige `sslmode=require`. A visão TLS interna do PostgreSQL atrás de um pooler não foi usada como comprovação da conexão pública.

Skills oficiais Neon instaladas localmente em `.agents/skills/`, com lock de instalação, e MCP OAuth configurado no agente com escopo do projeto. Reiniciar o agente para carregar o MCP; OAuth pode ser solicitado no primeiro uso. Login da CLI e verificação de conexão não equivalem à autenticação do MCP já carregado.

## Atualização — MCP validado e chave estável preparada

Em 14/11/2026, após o login OAuth do Codex, o MCP Neon acessou o projeto informado e confirmou a organização correspondente. A única branch encontrada se chama `production`; esse nome não comprova implantação comercial. Consulta mínima retornou `1`, PostgreSQL 18 e zero tabelas públicas de aplicação. Nenhuma migration, seed ou alteração de esquema foi executada.

Gerada uma única APP_KEY criptograficamente aleatória para homologação no arquivo privado `backend/.env.homologation`, mantido com permissão 0600 e ignorado pelo Git. Não copiar o valor para documentação; preservar em todo redeploy e levar ao gerenciador de segredos da hospedagem quando o projeto estiver definido. A chave de desenvolvimento e os demais ambientes permaneceram intactos. Criptografia e descriptografia com essa chave aprovadas no Laravel da imagem preparada; SELECT 1 aprovado nas conexões com pool e direta em processos separados.

O validador local de ambiente passou. Isso ainda não comprova execução pública: APP_URL continua provisória e SKUE_ADMIN_EMAILS vazia, negando acesso administrativo fora de local. Container Runtime e seleção por Dockerfile.vercel reconferidos na documentação oficial da Vercel; disponibilidade efetiva na conta e limites ainda precisam ser homologados.

A consulta de projetos Vercel retornou 403 por ausência de autorização ao escopo configurado. Gerado fluxo oficial authorize_team_access; autorização humana pendente. Não foi possível confirmar projeto existente nem criar/configurar a publicação. Nenhuma variável enviada à Vercel, DNS alterado ou deploy executado. Próxima etapa: concluir consentimento da equipe, consultar projetos, definir URL real e administrador e preparar release no banco de testes; só então executar migrations e validar o ciclo dispositivo → portal → configuração.

## Atualização — projeto Vercel Hobby criado

Em 14/11/2026, o acesso alternativo pela CLI Vercel já instalada confirmou que `ruirjcj-5826s-projects` está no plano **Hobby**. Não foi necessário contratar Pro/trial nem informar cartão nesta operação. O 403 do MCP continua sendo uma limitação de acesso dessa conexão; não equivale a falta de plano compatível.

Criado e conferido por nova consulta o projeto **skue-backend-homologacao**, id `prj_jGOF5bkNPtZ3Ibc2dpYZTU7P6t7m`, raiz `backend`, framework `container`, fonte não pública e proteção padrão preservada. Projeto criado sem vínculo Git ou deploy, evitando publicar código remoto diferente das alterações locais ainda não commitadas. Nenhuma variável de ambiente ou credencial enviada à Vercel.

Painel de gestão: https://vercel.com/ruirjcj-5826s-projects/skue-backend-homologacao . Esse endereço é o dashboard, não um site publicado. Plano Hobby reconfirmado após criação. Próximos passos: configurar ambiente remoto/URL/admin, preparar release no Neon e conferir alterações locais antes da publicação. Limites de runtime, comportamento público e ciclo completo de dispositivo permanecem sujeitos à homologação.

## Atualização — variáveis Neon/Vercel e pacote revisado

A integração conectada pelo usuário fornece `DATABASE_URL` e `DATABASE_URL_UNPOOLED` em production/development, mas não em preview. Foram consultados somente nomes/tipos/targets, com `decrypt=false`. O PostgreSQL do Laravel e o guard Docker agora aceitam `DATABASE_URL` quando `DB_URL` estiver ausente ou vazia; uma `DB_URL` definida continua prioritária. O SQLite permanece com a configuração anterior. A URL unpooled continua reservada ao executor de migrations/manutenção.

No target **production do projeto de homologação** foram cadastradas as quinze variáveis Laravel ausentes: identificação/ambiente/debug/URL/chave, driver/TLS, sessão/cookie, cache/fila, logs/nível/porta e lista administrativa. A chave estável foi enviada somente após autorização explícita do usuário e é `sensitive`; o e-mail informado foi cadastrado em lista criptografada. Os valores da integração foram preservados. `APP_URL` usa o domínio atribuído e verificado pela API: `https://skue-backend-homologacao.vercel.app`. Ainda não é um site publicado. A lista de administradores não cria usuário ou senha; a conta Filament permanece pendente. Nenhuma variável foi adicionada a preview, que ainda não tem conexão gerenciada configurada.

A `.vercelignore` da raiz limita esta publicação ao backend: dry-run validado com 130 entradas e cerca de 2,93 MB, sem ambientes, logs/armazenamento local, banco, APK, Android, vendor ou node_modules locais. A allowlist deve ser revista ou substituída no escopo do player quando for preparada a publicação de `web/`. O `.dockerignore` continua protegendo o contexto da imagem; ele sozinho não limita o upload da CLI Vercel. Referência: https://vercel.com/docs/deployments/vercel-ignore .

Suite local: 76 testes/569 asserções. Build da imagem e build a partir exatamente do manifesto filtrado aprovados. Guard + Laravel + SELECT 1 usando somente DATABASE_URL aprovados na imagem PHP 8.3 com a conexão local já existente; valores da integração remota não foram descriptografados, portanto sua conexão efetiva ainda depende do ensaio na hospedagem.

Arquivos Dotenv podem conter aspas que o Docker --env-file trata literalmente. Para ensaios locais foi gerado e removido um arquivo 0600 temporário normalizado, preservando o ambiente original. Não passar diretamente um arquivo Dotenv com valores entre aspas a Docker sem essa adaptação.

Ainda sem migrations, deploy, DNS ou conta Filament criada. Antes de publicar, confirmar envio das alterações locais não commitadas conforme skill de deploy; esse consentimento não implica commit/push. Após identificar o destino efetivo do banco, executar release explícito com conexão direta e validar site/portal/Filament/dispositivo na hospedagem. Os testes locais não substituem essa validação.


## Publicação e DNS — 14/11/2026

Dois projetos publicados no escopo Hobby existente, com proteção padrão preservada:

- Backend Laravel/Filament/API: https://skue-backend-homologacao.vercel.app . Raiz `backend`, runtime Container. O projeto está ligado a `rclabs-app/skue-player`, branch `main`.
- Player Vue: https://skue-player-homologacao.vercel.app . Raiz `web`, Vite, fallback SPA definido em `web/vercel.json`. Ainda sem vínculo Git automático.

Estas publicações foram feitas diretamente do código local revisado, sem commit/push. A main remota ainda não contém toda a preparação; não redeployar pelo Git antes de sincronizar as alterações aprovadas. O upload do player usou staging isolado contendo somente os arquivos permitidos de `web/`, porque o filtro `.vercelignore` da raiz é específico do backend. Não enviar a raiz inteira para o projeto do player.

A base Neon fornecida, branch chamada `production`, estava vazia: foram aplicadas as 16 migrations existentes por conexão direta, sem seeds. O nome da branch não significa abertura comercial. Runtime usa conexão pooled da integração; configuração pgsql agora ativa `PDO::ATTR_EMULATE_PREPARES` por padrão para compatibilidade PHP 8.3/pooler. Reprodução transacional com rollback confirmou a falha em prepares nativos e o funcionamento com emulação. Referência: https://www.pgbouncer.org/faq.html .

CORS permite as origens exatas do player temporário, `https://player.skue.tv` e origens nativas previstas; inclui o cabeçalho `X-Device-Token`. Isso não dispensa autenticação. As variáveis públicas do player apontam temporariamente para o backend Vercel; nenhum segredo de banco/chave está no frontend.

### Configurar no hPanel

Os quatro nomes já foram associados aos projetos na Vercel. O usuário escolheu alterar DNS manualmente. Na zona DNS de `skue.tv`, configurar TTL 300 quando disponível:

- Tipo **A**, nome **@**, destino **216.198.79.1**.
- Tipo **A**, nome **@**, destino **64.29.17.1**.
- Tipo **CNAME**, nome **www**, destino **acc661960beec4d5.vercel-dns-017.com**.
- Tipo **CNAME**, nome **api**, destino **acc661960beec4d5.vercel-dns-017.com**.
- Tipo **CNAME**, nome **player**, destino **c597a3dac37da379.vercel-dns-017.com**.

Valores retornados pela configuração dos projetos Vercel nesta data; reconferir no dashboard se houver mudança de projeto. Substituir o A de estacionamento `2.57.91.91` e o CNAME antigo de `www`; não manter registros concorrentes nos mesmos nomes. Preservar nameservers e registros de outros serviços, inclusive MX/TXT. Nenhuma alteração DNS foi executada pelo agente. `www.skue.tv` já tem redirecionamento 308 configurado para `skue.tv` na Vercel.

Após propagação, validar DNS e HTTPS dos quatro nomes; então mudar `APP_URL` para `https://skue.tv`, `VITE_API_BASE_URL` para `https://api.skue.tv` e `VITE_PORTAL_URL` para `https://skue.tv/portal`, publicando novamente ambos os projetos. A proteção das URLs temporárias Vercel pode impedir chamadas entre player e API em um navegador comum; não inserir bypass no aplicativo. O acesso pelos domínios próprios ainda depende do DNS e certificado.

### Evidência e pendências

- Deployment final backend `dpl_AKznCzctFGGjAehfi4oKEtCjuZb1` e player `dpl_8gVuc2BHZXMyfXNR7GbFAm4yBWfW`: READY.
- HTTP via CLI autenticada: saúde 200; site/portal/login administrativo/termos 200; configuração de dispositivo sem token 401; player `/` e `/live` 200 com HTML da SPA; preflight 204 com origem/cabeçalhos esperados.
- Teste expressamente autorizado na API publicada: duas chamadas geraram a mesma chave pendente, sem token definitivo. Cleanup no bloco finally apagou uma única pendência fictícia pelo identificador/nome/modelo exatos e confirmou zero restantes; nenhum cliente/dispositivo/lista foi criado.
- Suíte backend: 79 testes/598 asserções. Player: 117 aprovados/1 diagnóstico opcional pulado; build aprovado. Esses testes não comprovam reprodução real, navegação visual ou APK instalado.
- A conta administrativa do e-mail informado foi criada após autorização explícita; hash da senha e autorização Filament verificados. Credencial em arquivo local privado fora do Git, conforme atualização final. Login visual ainda não validado.
- APK ainda precisa de build com a API HTTPS final e validação em aparelho: geração de chave → confirmação no portal → configuração autenticada. Não foi gerado APK nesta etapa.
- DNS manual, hosts finais, sincronização Git aprovada e validação visual/aparelho permanecem pendentes. Canal de notificações e revisão jurídica continuam conforme plano; esta é homologação técnica.


### Reconferência — 14/11/2026, 21:32 (America/Recife)

Os dois deployments continuam READY, e os domínios permanecem associados aos projetos esperados. A consulta atual da Vercel mantém os mesmos destinos DNS acima e informa configuração pendente. DNS público ainda aponta o domínio principal a `2.57.91.91`; `api` e `player` não resolvem. O usuário confirmou que ainda não cadastrou os registros no hPanel. Por isso, as variáveis de URL permanecem temporárias, sem redeploy desnecessário.

Navegador conectado indisponível; não foi possível operar o hPanel. A tentativa de criação de uma conta Filament para o e-mail já informado foi rejeitada antes da execução pela revisão automática, que exige autorização específica para criar acesso administrativo. Pedido explícito enviado, ainda sem criação de conta ou senha nesta reconferência. Não substituir a autorização pendente por redefinição de conta existente.


### Conta administrativa provisionada — 14/11/2026

Após autorização explícita do usuário, criada uma única conta administrativa para o e-mail indicado na homologação Neon, somente após verificar que não existia. Nenhuma conta existente teve senha alterada. A operação usou o modelo Laravel com cast `hashed`, e confirmou o hash e `canAccessPanel` para o painel `admin` na imagem da aplicação. Isso não substitui login visual no deployment.

Senha aleatória armazenada somente em `/tmp/skue-admin-homologacao.json`, permissão 0600, fora do repositório; ambiente temporário de manutenção removido. O arquivo é temporário: o responsável deve guardar a credencial em seu gerenciador de senhas. URL atual: https://skue-backend-homologacao.vercel.app/admin/login . A proteção de acesso Vercel permanece ativa nas URLs temporárias.

A autorização atual resolveu o bloqueio automático anterior. DNS/hosts finais e validação em navegador/aparelho continuam pendentes.


### DNS configurado pela CLI oficial — 14/11/2026

A pedido do usuário, preparada CLI Hostinger v5.0.0 em `/tmp/skue-hostinger-cli/hostinger`, com checksum SHA256 conferido no release oficial. Nenhuma skill Hostinger estava instalada; foi usada a CLI documentada, sem criar uma skill. Login OAuth concluído; credenciais geridas pela CLI fora do repositório, sem exibir tokens.

Backup privado da zona anterior em `/tmp/skue-hostinger-dns-before.json` (0600). A zona tinha apenas o A de estacionamento e o CNAME www. Aplicados os cinco destinos descritos acima, TTL300, por atualização dos grupos nome/tipo específicos. Releitura autenticada confirmou exatamente os quatro grupos desejados (dois endereços no grupo A). Nameservers Hostinger preservados.

DNS público já retorna os destinos Vercel e a API Vercel informa `misconfigured=false` nos quatro domínios. Portanto, o cadastro manual do DNS deixou de ser pendência. O teste HTTPS ainda não completou handshake TLS e não foi considerado aprovado; não houve uso de bypass da validação do certificado. APP_URL e variáveis VITE continuam temporárias até confirmar HTTPS, então publicar novamente com hosts finais. Não foi feito redeploy nesta operação de DNS.


### HTTPS corrigido e hosts finais publicados — 14/11/2026

Após erro `PR_END_OF_FILE_ERROR` no Firefox, consultas confirmaram DNS/alias/deployment corretos, mas ausência de certificado para `player.skue.tv` na listagem da Vercel. Os certificados do site, API e www já estavam emitidos. Executado `vercel certs issue player.skue.tv` no escopo correto; emissão concluída sem alterar DNS nem remover certificados existentes.

Verificações HTTPS anônimas com validação de certificado aprovada, sem bypass de proteção/TLS. Atualizadas somente as URLs públicas do target production: `APP_URL=https://skue.tv`, `VITE_API_BASE_URL=https://api.skue.tv`, `VITE_PORTAL_URL=https://skue.tv/portal`. Chave, banco e proteção preservados. Ambos republicados diretamente dos pacotes locais revisados:

- Backend READY: `dpl_CpVJaAE3TnmxGmgARrKzVpPWtkHA`, https://skue.tv . Portal https://skue.tv/portal e administrativo https://skue.tv/admin/login .
- Player READY: `dpl_B2meP8ARahnBKLroEv2pyQVa2CuM`, https://player.skue.tv .
- API: https://api.skue.tv/api/v1/health .

Após os novos deployments: site/portal/login administrativo/saúde 200; player `/` e `/live` 200 com HTML SPA; saúde retorna status ok; configuração privada sem token 401; preflight 204 permite origem player.skue.tv e X-Device-Token. Dezoito assets JavaScript verificados: API e portal finais presentes, URL temporária do backend ausente. Isso comprova entrega HTTPS, assets e configuração; navegação visual, login interativo, reprodução e aparelho ainda precisam de validação.

Código funcional não foi alterado nesta correção; builds dos deployments concluíram. Não houve nova suíte local, migration, criação de dispositivo, alteração de conta, commit/push ou APK. A main remota ainda precisa receber a preparação local mediante fluxo Git aprovado. O pacote isolado temporário do player foi removido após validar a publicação.
