<?php

return [
    // Immutable release identifier: change it whenever any published text changes.
    'version' => '2026-11-12-draft.1',
    'status' => 'Minuta para testes — revisão jurídica e dados do responsável pendentes',
    'documents' => [
        'terms' => [
            'title' => 'Termos de Uso',
            'path' => '/termos',
            'sections' => [
                ['title' => 'Software e fontes próprias', 'text' => 'O Skue é um software para organizar e reproduzir mídia de fontes informadas pelo usuário. Não oferece canais, catálogo, listas compartilhadas ou indicação de fornecedores. A licença do software não inclui acesso a conteúdo. Não há oferta vitalícia.'],
                ['title' => 'Uso das fontes', 'text' => 'Cadastre somente fontes que você esteja autorizado a acessar. Não utilize o aplicativo para violar direitos de terceiros ou contornar proteções de acesso. Disponibilidade, autorização e qualidade da fonte dependem de seu responsável.'],
                ['title' => 'Funcionamento e compatibilidade', 'text' => 'O portal permite gerenciar configurações por dispositivo. URLs e credenciais cadastradas são armazenadas no backend para sincronização. A importação de listas pode passar pelo servidor como alternativa ao acesso direto; a reprodução usa a fonte no dispositivo. A compatibilidade depende da origem, rede, navegador e aparelho. Android e Web estão em testes; Tizen e WebOS permanecem planejados.'],
                ['title' => 'Dados e atendimento', 'text' => 'Consulte a Política de Privacidade sobre dados locais, configuração sincronizada e serviços externos. O aceite registra versão, identificador declarado do dispositivo, plataforma e data no servidor. Ele não substitui consentimentos específicos que eventualmente sejam necessários. O canal de contato está em preparação e será informado na página de atendimento.'],
                ['title' => 'Alterações e direitos', 'text' => 'Uma nova versão destes documentos exige novo aceite no aplicativo conectado. Sem conexão, uma confirmação anterior permite usar a última versão conhecida; um novo aceite exige confirmação online. Estes textos não afastam direitos previstos na legislação nem constituem garantia de imunidade ou exclusão geral de responsabilidade.'],
                ['title' => 'Responsável e estado da minuta', 'text' => 'Nome ou razão social, CPF/CNPJ quando aplicável e endereço do responsável pelo serviço ainda não foram confirmados. Esta minuta é destinada aos testes e precisa desses dados, do atendimento operacional e da revisão jurídica brasileira antes da abertura comercial.'],
            ],
        ],
        'privacy' => [
            'title' => 'Política de Privacidade',
            'path' => '/privacidade',
            'sections' => [
                ['title' => 'Responsável e finalidade', 'text' => 'A identificação e o endereço do responsável pelo tratamento ainda estão pendentes de confirmação. Esta minuta descreve o fluxo técnico atual para identificação do aparelho, gerenciamento de configurações, sincronização e funcionamento do player; não declara conformidade jurídica concluída.'],
                ['title' => 'Dados no servidor', 'text' => 'O backend mantém identificador do dispositivo, nome e estado cadastral, configurações de listas, URLs e credenciais fornecidas para sincronização. O pareamento guarda configuração temporária. Novas gravações de URLs, usuários, senhas e payloads de pareamento usam criptografia da aplicação; a conversão dos registros legados ainda depende de execução operacional. O aceite registra versão, identificador declarado, plataforma e data, com identificador técnico para evitar duplicações. Não grava endereço IP na tabela de aceites.'],
                ['title' => 'Dados no aparelho', 'text' => 'Catálogo importado, histórico, favoritos e preferências ficam no armazenamento local do navegador ou aplicativo. O dispositivo também mantém identificação e dados necessários à sincronização. Limpar dados do app/navegador pode eliminar esses registros; isso não apaga automaticamente as configurações no servidor.'],
                ['title' => 'Tráfego e serviços externos', 'text' => 'A lista pode ser obtida diretamente ou pelo backend como alternativa técnica de importação. O vídeo é solicitado pelo dispositivo à fonte escolhida. Fontes externas recebem dados da conexão, como IP, e parâmetros necessários ao acesso. O app consulta metadados por meio da integração com TMDB; imagens e outras requisições externas dependem da tela e da configuração. Hospedagem e infraestrutura podem processar registros técnicos. Provedores definitivos, localização de tratamento e eventuais transferências internacionais ainda precisam ser inventariados antes da abertura comercial.'],
                ['title' => 'Retenção e exclusão', 'text' => 'A exclusão de dispositivo remove suas listas no banco ativo. Isso não comprova eliminação imediata de cópias de segurança, registros de infraestrutura ou dados locais no aparelho. Prazos, bases legais por finalidade, retenção do aceite, descarte de backups/logs e o procedimento operacional para solicitações ainda devem ser definidos e revisados. Não há prazo definitivo de retenção aprovado nesta minuta.'],
                ['title' => 'Solicitações e segurança', 'text' => 'As solicitações sobre acesso, correção, exclusão e demais direitos relativos aos dados deverão ser encaminhadas ao responsável pelo canal de contato, atualmente em preparação. Não envie senhas, chaves do dispositivo, tokens ou URLs privadas de listas. O aceite dos termos não representa autorização genérica para qualquer tratamento de dados.'],
            ],
        ],
        'notice' => [
            'title' => 'Aviso Legal',
            'path' => '/aviso-legal',
            'sections' => [
                ['title' => 'Licença de software', 'text' => 'O Skue apresenta um reprodutor de mídia. A oferta se refere ao software, sem promessa de canais, catálogo ou conteúdo incluído. Não fornece listas nem recomenda vendedores de conteúdo.'],
                ['title' => 'Limites técnicos atuais', 'text' => 'Configurações de fontes são armazenadas para sincronização. A importação pode utilizar o backend; a restrição técnica do proxy exclusivamente a listas ainda está pendente. A reprodução normal solicita mídia diretamente no aparelho. Esta descrição não equivale a uma auditoria de rede ou a uma promessa de que nenhum dado passa pelo servidor. Não há funcionalidade de guia de programação nesta versão.'],
                ['title' => 'Notificações e análise', 'text' => 'Questões relacionadas a recursos do Skue serão tratadas pelo procedimento de atendimento assim que o canal estiver operacional. A análise distingue recursos administrados pelo Skue de fontes externas; não há promessa de apagar material hospedado por terceiros. O caráter de reprodutor não dispensa avaliação do caso concreto nem revisão jurídica.'],
            ],
        ],
    ],
];
