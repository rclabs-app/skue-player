# Portal Skue: comparação e plano de melhoria

Data: 10/11/2026, America/Recife. Escopo: site público, ativação, portal de listas e integração com o aplicativo.

## Conclusão

O Skue pode se diferenciar pela facilidade de configurar, pela gestão familiar e pela clareza ao resolver problemas. Antes de ampliar recursos, precisa corrigir inconsistências entre o site, o portal Blade, a API e o aplicativo. A principal oportunidade é o usuário conseguir instalar, vincular, cadastrar a própria lista e confirmar que ela chegou ao aparelho sem precisar de suporte.

“Ser o melhor” é uma direção de produto, não um resultado demonstrado por esta análise. Não há medição comparativa de reprodução, disponibilidade, conversão ou satisfação que sustente um ranking.

## Método e limites

- Foram consideradas cinco referências distintas; Duplecast foi informado duas vezes.
- Foram consultadas páginas públicas e formulários de entrada, ajuda e envio de listas. Nenhuma conta criada, autenticação efetuada, compra iniciada ou lista enviada a concorrentes.
- Recursos anunciados são declarações dos sites. Não comprovam desempenho, estabilidade, segurança do servidor ou qualidade da experiência autenticada.
- A inspeção visual pelo navegador não estava disponível nesta sessão. Não foram medidos contraste, comportamento responsivo, acessibilidade prática, Core Web Vitals ou disposição visual renderizada.
- A página principal do IBO Player não retornou conteúdo textual legível. Foram consultadas páginas públicas em subdomínios de iboplayer.com; isso limita a comparação da página inicial.
- No Skue, a evidência principal é leitura estática de rotas, controllers, modelos, templates e testes existentes. Também foi verificado HTTP 200 no login Laravel e nos dois downloads, com inspeção dos cabeçalhos e hashes dos arquivos locais. Não foram acessados dados pessoais ou listas reais, nem executados testes de invasão.
- A infraestrutura observada na tarefa anterior de APK é contexto histórico; não equivale a uma medição de disponibilidade de produção nesta análise.
- Alterações funcionais não foram realizadas. Todos os itens de evolução abaixo são propostas, não requisitos já aprovados.

## O que aprender com cada referência

### Duplecast

O site distingue avaliação, ativação, gestão do dispositivo, instalação e suporte. A página explicativa descreve instalação, obtenção dos dados do aparelho, cadastro da lista e ativação. O formulário de gestão pede Device ID e Device Key.

É a referência mais útil desta amostra para estruturar a jornada e a documentação do Skue. A página de recursos anuncia gestão de múltiplos dispositivos, continuidade de reprodução e proteção parental; essas funções não foram testadas. Não adotar alegações como desempenho multiplicado sem um benchmark próprio.

Fontes: [início](https://duplecast.com/), [jornada explicada](https://duplecast.com/how-it-works), [gestão do aparelho](https://duplecast.com/plugin/duplecast/device_login/), [recursos anunciados](https://duplecast.com/features).

### Rivolut Player

A entrada no portal é direta: MAC e chave para gerenciar listas. A ajuda aborda problemas concretos, como mudança do identificador, falha ao iniciar e EPG. A simplicidade é aproveitável; há espaço para o Skue oferecer instruções contextualizadas, em português consistente, junto ao campo que provoca dúvida.

Não foi possível comparar o painel autenticado. As orientações de MAC desse concorrente não devem ser copiadas como se descrevessem a identidade gerada pelo Skue.

Fontes: [login](https://rivolutplayer.com/login), [ajuda](https://rivolutplayer.com/support).

### IBO Player

As páginas públicas consultadas oferecem consulta por MAC, envio de lista por host, variante com usuário e senha e opção de proteção por PIN. Elas mostram como separar ações específicas em formulários objetivos. O Skue pode oferecer esses caminhos com uma orientação mais coesa dentro do mesmo painel.

Não concluir que o site inteiro dispensa chave ou que sua autenticação é insegura a partir dos campos de um formulário público. A implementação do servidor não foi avaliada.

Fontes: [consulta de MAC](https://activation.iboplayer.com/check-mac), [adicionar lista](https://activation.iboplayer.com/add-play-list), [conta com usuário e senha](https://activation.iboplayer.com/add-play-list?type=xc).

### Duplex24

O envio de listas apresenta instruções numeradas e campos de MAC, nome e URL. É um fluxo curto que podemos preservar no Skue sem esconder explicações importantes.

O conteúdo público consultado contém referências a marcas e domínios diferentes e avisos sobre suspensão e sites não oficiais. Independentemente da origem desses textos, esse é um padrão de comunicação a evitar: o usuário do Skue deve reconhecer um domínio oficial, um nome de produto e caminhos de suporte consistentes. Não foi verificado se os avisos aparecem como modais na renderização.

Fontes: [início](https://duplex24.com/), [gestão de listas](https://duplex24.com/mylist).

### IPTV Duplex

O site em português explica URL, arquivo, conta e vídeo individual; o formulário apresenta essas modalidades em abas. Também anuncia organização de categorias, proteção por PIN, EPG e controle pelo navegador. É uma boa referência para apresentar opções de importação sem exigir que o usuário conheça a terminologia técnica.

A página de compra consultada orienta trocar país usando VPN em caso de falha de pagamento. O Skue deve oferecer diagnóstico, meios suportados e suporte para pagamentos, sem depender desse procedimento. Não foi feita compra ou validação do checkout.

Fontes: [apresentação](https://iptvduplex.com/pt-br), [envio de listas](https://iptvduplex.com/pt-br/upload-playlist), [compra](https://iptvduplex.com/pt-br/purchase).

## O que o Skue já possui

- Site público em Blade, com apresentação, download e preços: `backend/resources/views/welcome.blade.php` e `layouts/app.blade.php`.
- Portal Laravel com sessão, CSRF nos formulários, entrada por MAC/chave, listagem, criação e exclusão de listas M3U/Xtream: `backend/routes/web.php`, `backend/app/Http/Controllers/PortalController.php` e `backend/resources/views/portal/`.
- Portal Vue com API, edição, ativação/desativação e seleção da lista principal: `web/src/views/PortalLoginView.vue`, `PortalDashboardView.vue` e `backend/app/Http/Controllers/Api/PortalController.php`.
- Modelos de cliente, aparelho e assinatura, com administração Filament. O painel administrativo não equivale a uma conta familiar ou portal de revendedores.
- Backend recebe configuração remota de listas; o dispositivo consulta sua configuração e faz o processamento local. Não é correto prometer que nenhuma URL ou credencial sai do aparelho, pois o portal persiste esses dados.
- Estrutura de pareamento temporário em `Api/PairingController.php`; é um ponto de partida para uma experiência melhor, mas seu protocolo e vínculo com a identidade do aparelho precisam ser revisados antes de reutilização como login.

Portanto, não precisamos reconstruir tudo para ganhar recursos básicos. Precisamos consolidar regras e completar a jornada.

## Prioridade 0: corrigir antes de uma publicação comercial

### 1. Comprovar posse do dispositivo

**Evidência:** a rota pública de handshake recebe um identificador, busca o aparelho existente e devolve sua chave e um token. Não há prova de posse exigida nesse método. Referências: `backend/routes/api.php`, `Api/DeviceController.php:18`, `:30`, `:81` e `:90`.

**Implicação:** o identificador não pode ser tratado como segredo suficiente para recuperar credenciais. Isso enfraquece a proteção de um portal com MAC e chave. Não foi explorado nenhum aparelho real.

**Proposta:** identidade instalada com segredo próprio; bootstrap seguro de novo aparelho; recuperação e vinculação por desafio temporário e confirmação no aplicativo. O handshake de um aparelho já registrado deve exigir prova de posse e não revelar a chave apenas porque o identificador foi informado.

**Aceite:** em testes isolados, informar apenas o identificador de um aparelho existente não entrega chave, token ou listas; a instalação legítima continua funcionando e possui recuperação documentada.

### 2. Fortalecer as sessões do portal

**Evidência:** login Blade grava `portal_device_id`, sem regeneração explícita da sessão no método; logout apenas remove essa chave. A rota POST de login não declara throttle específico. O portal API emite token com ID criptografado, sem expiração ou registro de revogação no resolvedor; o Vue o guarda em localStorage. Há throttle no grupo da API e CSRF nos formulários Blade, portanto essas proteções já existem parcialmente.

**Proposta:** limite de tentativas por origem e dispositivo, regeneração/invalidação de sessão, tokens com duração e revogação, separação de escopos e opção de desconectar acessos. Para o portal Blade, manter cookies de sessão protegidos e configurar HTTPS corretamente no ambiente publicado.

**Aceite:** logout/revogação invalida o acesso no servidor; sessões expiram; repetição de tentativas é limitada; usuário só gerencia seus aparelhos. Não considerar limpar localStorage equivalente a revogar o token.

### 3. Mostrar licença real e alinhar oferta comercial

**Evidência:** `portal/dashboard.blade.php:58` e `:60` exibem licença a partir de `isKeyExpired()`. O modelo possui `isLicensed()`, assinatura e período de teste, que são conceitos distintos. A chave é estendida por cem anos em `Device::refreshKey()`.

Além disso, a home anuncia anual de € 4,99 e vitalícia de € 9,99; `Api/PaymentController.php` aceita somente plano anual, de R$ 19,90. O link “Renovar Licença” aponta a `/portal#renovar`, sem seção correspondente nos templates inspecionados.

**Proposta:** um catálogo de planos compartilhado e um estado de licença próprio, usado por site, portal, API e app. Distinguir teste, ativa, expirada e bloqueada. Não confundir chave de acesso com licença.

**Limite atual:** a pausa de assinatura para testes deve ser preservada. Corrigir o significado dos dados e preparar a configuração comercial não autoriza reativar cobrança, bloqueios ou publicar os preços atuais.

### 4. Tornar download e páginas de confiança completos

**Evidência:** a landing usa `/downloads/skue-tv.apk`, e a rota Laravel definida usa `/download/skue-tv.apk`. A verificação local mostrou HTTP 200 e tipo APK nos dois caminhos: existem arquivos estáticos nas duas pastas públicas. Portanto, não há link quebrado comprovado nesses caminhos. Há três artefatos diferentes: o download plural tem 8.620.879 bytes; o singular, 8.628.163 bytes; e `download/skue-tv.apk`, o APK local mais recente, 8.680.456 bytes. Os SHA-256 dos três arquivos locais são distintos e os dois tamanhos públicos correspondem aos cabeçalhos HTTP. Como a rota prioriza o arquivo da pasta pública, substituir apenas o APK da pasta download na raiz não garante atualizar o instalador servido. A landing ainda informa 69 MB.

Os links de termos, privacidade e aviso legal no rodapé usam `href="#"`. O menu do cabeçalho usa `hidden md:flex` sem alternativa móvel encontrada no template. O login diz que a chave diferencia maiúsculas e minúsculas e muda periodicamente, mas o controller normaliza a chave e o modelo a mantém por longo prazo.

**Proposta:** rota nomeada para download, metadados obtidos do artefato de release, distinção entre APK local/debug e versão pública assinada; páginas reais de suporte e políticas; navegação móvel; texto de identificação consistente. Não disponibilizar como release público o APK atual que depende do IP do computador.

**Aceite:** links verificados no ambiente alvo, download real funcionando, versão/tamanho corretos e principais ações acessíveis no celular. O menu móvel deve ser confirmado por renderização, não apenas pela presença de classes CSS.

## Prioridade 1: um portal que as pessoas consigam usar sem ajuda

### 5. Consolidar Laravel e Vue

O mesmo caminho `/portal` pode abrir o Vue no host do Vite e o Blade no host Laravel. O Blade só cria/exclui; o Vue/API também edita e define principal. Até os limites de nome e normalização de entrada diferem. O controller Blade não aplica a regra de primeira lista principal que existe na API.

**Recomendação:** assumir o portal público Laravel como entrada canônica, manter o aplicativo Vue e extrair serviços compartilhados para autenticação, listas e licença. Completar no Blade edição, ativação e lista principal. Não é necessário migrar de framework para resolver isso. Essa arquitetura é uma proposta, não uma migração aprovada.

**Aceite:** a mesma operação produz os mesmos dados e validações independentemente do cliente. Principal deve continuar coerente após inclusão, alteração e exclusão, com testes de autorização e concorrência quando aplicável.

### 6. Cadastro guiado da própria lista

Fluxo proposto: **conectar aparelho → escolher URL/conta/arquivo → validar entrada → confirmar → acompanhar sincronização**.

- Detectar URL M3U e separar conta Xtream em servidor, usuário e senha.
- Validar campos antes de salvar, sem esconder mensagens de erro num alerta genérico.
- Oferecer importação de arquivo somente após definir limites, retenção e processamento compatíveis com o desenho local-first.
- Permitir salvar alterações sem exigir redigitação da senha já armazenada: hoje o modelo oculta a senha na API e a edição Vue preenche o campo com vazio quando ela não vem na resposta.
- Mostrar senhas e parâmetros sensíveis mascarados. A URL completa está renderizada no cartão Blade e pode conter credenciais; truncamento visual não remove esses dados do HTML.

Uma verificação de fonte pode consumir uma conexão da conta. Deve ser curta, explícita, limitada e não concorrer silenciosamente com o player. Um HTTP 200 não comprova que haverá reprodução contínua.

### 7. Confirmar entrega ao dispositivo

O painel precisa distinguir **salvo no portal**, **recebido pelo aparelho**, **importando** e **pronto**. Atualmente salvar uma lista não significa que o aplicativo já a recebeu ou terminou de processá-la.

**Proposta:** revisão de configuração por dispositivo e confirmação do app, com identificador da revisão, horário e resultado resumido. `last_seen_at` já existe, mas não prova importação ou reprodução; presença recente também não deve ser chamada de “assistindo agora”.

**Aceite:** o portal só mostra “recebido” depois da confirmação daquela revisão; quando offline, informa que a alteração ficará aguardando e oferece orientação concreta.

### 8. Diagnóstico que reduza atendimento

Mostrar separadamente: conexão do app com a API, autenticação da fonte, leitura da lista e compatibilidade do formato. Oferecer código de atendimento e relatório resumido, sem URLs privadas, senhas ou histórico de conteúdo.

Exemplos: “Aparelho ainda não recebeu a alteração”, “Servidor da lista recusou o acesso” e “Formato não suportado neste dispositivo”. Não atribuir automaticamente ao provedor um problema de origem ainda desconhecida.

## Prioridade 2: diferenciação para famílias

### 9. Conta com vários aparelhos e controle familiar

Permitir uma conta opcional do responsável com aparelhos nomeados, como “TV da sala” e “Celular”, revogação de vínculos e configuração por aparelho. Cliente/Device no backend é uma base, mas a jornada de cadastro, recuperação e vinculação ainda precisa ser construída.

No perfil infantil, propor PIN do responsável e listas/categorias explicitamente permitidas, com regras aplicadas também no aplicativo e comportamento definido offline. Não depender apenas do nome da categoria nem prometer que um filtro automático comprova adequação do conteúdo.

Evitar localização e histórico detalhado de visualização como padrão. Controle familiar deve informar claramente quais configurações são sincronizadas e quais dados são armazenados.

### 10. Ajuda por plataforma e operação confiável

Criar guias para as plataformas realmente testadas, uma página de status e um canal de suporte com versão do app e modelo do aparelho. Administrar incidentes e erros agregados no Filament, com acesso restrito.

Anunciar Samsung/LG e lojas específicas somente quando houver distribuição e compatibilidade validadas. Gestão de revendedores pode vir depois; a existência desse recurso no concorrente não justifica antecipá-lo à experiência do usuário final.

## Organização sugerida do portal

**Área pública:** início, como funciona, instalar, compatibilidade, ajuda/status e acesso ao painel. Preços e compra apenas após decisão sobre a retomada comercial.

**Área autenticada:** visão geral, aparelhos, listas, controle familiar e suporte; licença e pagamentos quando autorizados. Cada ação deve explicar resultado e próximo passo. Manter o visual sóbrio já solicitado, com contraste e foco verificados em dispositivos reais.

## Como medir se estamos melhorando

Propostas iniciais de metas; nenhuma foi medida nesta tarefa:

- Pessoa com lista válida conseguir concluir a primeira configuração sem suporte em até dois minutos, em teste de usabilidade definido.
- Medir tempo entre salvar e confirmar recebimento no aparelho online; propor p95 de até 15 segundos e verificar a compatibilidade com o backoff atual do polling antes de assumir compromisso.
- Medir sucesso e abandono por etapa da ativação, separando API, lista e dispositivo.
- Nenhum link essencial quebrado na release e navegação concluída em celular sem depender de menus de desktop.
- Medir taxa de pedidos de suporte por cem ativações, com linha de base antes da mudança.
- Testes manuais de teclado/leitor de tela e telas de 360 px, além de automação adequada. Conformidade de acessibilidade não está certificada por esta análise.

Não criar um número de nota para cada concorrente sem dados equivalentes. Para desempenho de reprodução, seria necessário um benchmark separado com mesma fonte, aparelho, rede e duração, observando limites de conexão.

## Ordem recomendada

1. Identidade do aparelho, sessões e dados de licença; integridade do download e comunicação pública.
2. Portal canônico e regras compartilhadas; edição/principal e cadastro guiado.
3. Confirmação de sincronização e diagnóstico.
4. Conta familiar, proteção parental e gestão de aparelhos.
5. Pagamentos após retomada comercial autorizada; revendedores e expansões depois de validar o uso básico.

Os próximos testes de implementação devem cobrir posse do aparelho, expiração/revogação, isolamento entre usuários, estados reais de licença, consistência de planos e operações Blade/API. A suíte existente foi inspecionada, mas não executada nesta tarefa; seus resultados históricos não validam estas propostas.
