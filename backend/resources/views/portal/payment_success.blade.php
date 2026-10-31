<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skue Player - Ativação Concluída</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0b1118] text-white min-h-screen flex items-center justify-center p-4 font-sans">
    <div class="max-w-md w-full bg-[#131c26] border border-green-500/30 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
        <div class="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4 text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h1>
        <p class="text-gray-400 text-sm mb-6 leading-relaxed">
            Sua licença foi processada com sucesso. O seu dispositivo MAC já está liberado automaticamente em nossos servidores.
        </p>

        @if(request('mac'))
        <div class="bg-black/40 border border-gray-800 rounded-xl p-4 mb-6 text-left">
            <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Dispositivo Ativado</span>
            <span class="font-mono text-base font-bold text-green-400">{{ request('mac') }}</span>
        </div>
        @endif

        <div class="space-y-3">
            <p class="text-xs text-gray-500 leading-tight">
                Você já pode voltar para a sua Smart TV ou aplicativo. Caso a tela ainda esteja bloqueada, clique em <strong>"Verificar Licença"</strong>.
            </p>
            <a href="/portal" class="inline-block w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-600/30">
                Acessar Portal de Playlists
            </a>
        </div>
    </div>
</body>
</html>
