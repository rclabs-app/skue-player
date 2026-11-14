# Proteção e recuperação das configurações

Implementação de 12/11/2026. Este procedimento não executa pagamentos, não altera as fontes de vídeo e não substitui a revisão jurídica/operacional do lançamento.

## Dados e fronteiras de acesso

- O portal recebe URL e, em conexões Xtream, usuário e senha. URLs também podem conter credenciais no caminho, na autoridade ou nos parâmetros; por isso toda a URL é protegida.
- `DevicePlaylist` criptografa os três campos ao gravar pelo Eloquent. Valores nulos continuam nulos. A criptografia usa o serviço autenticado do Laravel e um prefixo de formato versionado.
- Registros legados em texto continuam legíveis durante a transição. Isso não protege retroativamente o banco: é necessário executar a conversão explícita abaixo.
- A serialização comum do modelo e os endpoints de gerenciamento de playlists retornam metadados, sem URL/usuário/senha. Isso altera intencionalmente a resposta da API antiga do portal: clientes que dependiam desses campos precisam ser adaptados.
- A tela de edição Blade pode mostrar URL e usuário ao dono autenticado para permitir correção. A senha não é reapresentada; omitir sua substituição mantém a senha existente.
- A configuração do aparelho em `/api/v1/devices/{mac}/config` entrega os três campos somente após validação do token e da correspondência do MAC. Consultas/alterações de listas são limitadas à relação do dispositivo.
- O pareamento recebe um payload que pode conter uma URL. `PairingCode` também o criptografa em repouso, e a inspeção do código não revela o payload. O consumo continua pelo código temporário, com expiração e uso único; esse protocolo usa posse do código, não vínculo novo com um token de dispositivo.
- As respostas de portal, configuração, pareamento e proxy recebem `Cache-Control: no-store, private`. Isso orienta clientes e caches; não impede captura pelo próprio dispositivo ou por software com acesso a ele.
- URL, usuário, senha, chave de dispositivo, token e payload não são gravados como entradas antigas da sessão em erros de validação. A falha de login reapresenta apenas o MAC. Após erro em um cadastro novo, é necessário preencher os campos sensíveis novamente.
- Erros de busca no proxy não devolvem a mensagem da exceção da origem. Logs explícitos do player/importação deixam de imprimir trechos da URL e objetos de erro de rede/nativos.
- O dispositivo precisa da URL/credenciais em memória para buscar a fonte. O banco local do player e ferramentas de rede do navegador continuam dentro da fronteira de confiança do aparelho; não foi implementada criptografia de armazenamento local do cliente nesta etapa.
- O proxy ainda é o atual da importação; limitar seus formatos/destinos continua pendência da etapa 2.

## Chaves e preparação

1. Confirmar a configuração válida da chave da aplicação no gerenciador de segredos do ambiente. Não imprimir, versionar, enviar por chat nem copiar a chave para este documento.
2. Guardar uma cópia recuperável da chave em local protegido separado do banco e do backup. Perder todas as chaves que leem os dados impede a recuperação.
3. Não executar `key:generate` sobre uma instalação com dados protegidos. Isso também pode invalidar tokens e outros dados do Laravel.
4. A configuração já suporta chaves anteriores por `APP_PREVIOUS_KEYS`. O Laravel pode ler dados antigos com essas chaves; novas gravações usam a chave atual. A compatibilidade de leitura foi testada com chaves sintéticas.
5. A rotina desta etapa converte texto legado, mas não faz rotação geral de ciphertext já existente. Não remover uma chave anterior enquanto houver valores ou backups que dependam dela. Uma recriptografia completa exige operação específica posterior.
6. Garantir backup integral protegido do banco e do ambiente, além do backup restrito gerado pelo comando. O backup do comando não contém catálogo completo, dados de clientes nem esquema e não substitui backup integral.
7. Fazer a operação em janela de manutenção: suspender requisições e workers que possam alterar configurações ou consumir pareamentos. Verificar que o ambiente correto está selecionado sem exibir credenciais.
8. Em produção, manter debug desativado, HTTPS nos acessos ao portal/API, acesso restrito ao banco/arquivos e ausência de captura de corpos sensíveis nos logs do servidor, proxy reverso, observabilidade e CDN. Esses serviços externos não foram inspecionados nesta implementação.

## Aplicação em uma instalação existente

Os comandos a seguir são instruções operacionais, não evidência de execução no banco em uso. Os testes desta tarefa usaram SQLite em memória e diretórios temporários próprios.

1. Sob manutenção, aplicar a migration de ampliação de `device_playlists.username/password` para TEXT e `pairing_codes.payload` para MEDIUMTEXT. URLs já usam TEXT. A ampliação comporta o aumento de tamanho da criptografia.

   ```sh
   cd backend
   php artisan migrate
   ```

2. Inspecionar quantas configurações legadas precisam de conversão, sem alterá-las:

   ```sh
   php artisan playlists:protect-credentials
   ```

3. Conferidas chaves, backup integral, armazenamento privado e ambiente, converter:

   ```sh
   php artisan playlists:protect-credentials --apply
   ```

O comando percorre playlists e payloads de pareamento. Valores já protegidos são verificados e mantidos; execuções repetidas sem novos valores legados não criam nova conversão nem backup.

Antes da primeira atualização, escreve um backup criptografado autenticado em `storage/app/private/playlist-credential-backups/`, em arquivo exclusivo com permissão 0600, e confere sua leitura. O backup contém somente campos sensíveis originais dos registros alterados, identificadores e verificadores dos valores convertidos. Sem backup verificado, a conversão é interrompida.

A transformação usa uma transação e verifica a leitura dos campos convertidos. Não altera IDs, vínculo de dispositivo, estado principal/ativo, timestamps ou expiração. Os comandos mostram contagens e caminho do backup; não mostram valores, chaves ou mensagens originais de exceções.

4. Confirmar contagem pendente zero e testar, ainda no ambiente controlado, login, edição sem trocar senha, sincronização do aparelho autorizado e consumo único do pareamento. Só então encerrar a manutenção.

Compatibilidade foi testada em SQLite. A ampliação declarada para MySQL/MariaDB não foi executada contra um servidor desses nesta tarefa; validar no banco de homologação utilizado antes da implantação. A migration de estrutura não encolhe as colunas no rollback, evitando truncar ciphertext.

## Recuperação

Antes de tentar recuperar, manter a aplicação sob manutenção e preservar o banco atual, o backup escolhido e as chaves necessárias. Usar apenas um arquivo gerado pela operação e correspondente ao mesmo banco.

1. Verificar a recuperação sem modificar registros:

   ```sh
   php artisan playlists:restore-credentials CAMINHO_DO_BACKUP.enc
   ```

2. Para uma reversão deliberada da transformação, aplicar o mesmo backup:

   ```sh
   php artisan playlists:restore-credentials CAMINHO_DO_BACKUP.enc --apply
   ```

A recuperação verifica autenticação do arquivo, identidade do banco, vínculo dos registros e se os campos atuais ainda correspondem aos valores gerados na conversão. Se qualquer lista/payload foi excluído, consumido ou teve suas credenciais alteradas depois, recusa toda a restauração sem recriar registros nem sobrescrever as alterações novas. Nesse caso, avaliar o backup integral e a recuperação específica com o operador; não editar o backup para contornar a conferência.

O identificador do banco inclui driver e caminho/nome configurado. Uma cópia restaurada em outro caminho pode ser recusada por esta rotina. A rotina de campos foi testada com ida/volta no mesmo banco isolado; restauração completa de infraestrutura tem procedimento próprio.

A reversão restaura o formato original dos campos, que pode ser texto legado. O código atual consegue lê-lo durante a transição; isso não significa que os dados revertidos continuem protegidos em repouso. Corrigir a causa e repetir a proteção antes de reabrir o serviço. Não fazer rollback para código antigo enquanto o banco ainda contiver valores que ele não sabe interpretar.

## Exclusão, retenção e limites

- Excluir uma lista remove o registro ativo. Excluir o dispositivo remove suas listas por cascade; ambos os cenários foram testados.
- Pareamentos são apagados no consumo; expirados são removidos ao criar novos códigos, conforme fluxo já existente. Não foi adicionado agendamento de limpeza automática.
- Excluir no banco ativo não modifica cópias anteriores, backups, logs históricos ou o conteúdo já sincronizado no aparelho. Não há promessa de apagamento seguro dos bytes do arquivo físico nesta etapa.
- O backup de conversão é privado e criptografado, mas pode conter configurações posteriormente excluídas. Não é servido por rota pública nem incluído no Git. Mantê-lo somente pelo período de recuperação aprovado; definir prazo e responsável antes da publicação. Nenhum expurgo de backups reais foi executado.
- Logs anteriores à mudança podem conter dados antigos. A equipe deve avaliar retenção, restrição de acesso e descarte desses logs; esta alteração não apaga nem inspeciona logs históricos de usuários.
- A proteção de credenciais não cobre todas as superfícies do produto e não certifica conformidade jurídica ou prontidão de produção.
