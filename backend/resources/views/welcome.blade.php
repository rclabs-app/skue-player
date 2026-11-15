@extends('layouts.app')

@section('content')
<!-- Hero Section with asymmetrical layout -->
<section class="relative bg-white dark:bg-[#111216] pt-12 pb-20 lg:pt-24 lg:pb-28 overflow-hidden transition-colors duration-300">
    <!-- Distinct diagonal background split -->
    <div class="absolute inset-0 bg-gray-50 dark:bg-[#0c0d10] [clip-path:polygon(0_0,100%_0,100%_80%,0_100%)] transition-colors duration-300"></div>

    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            
            <!-- Left: Content -->
            <div class="lg:col-span-5 text-left mb-16 lg:mb-0">
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-[1.1] mb-6 transition-colors duration-300">
                    Sua nova central<br>de mídia.
                </h1>
                <p class="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed font-light transition-colors duration-300">
                    Organize e reproduza suas próprias listas de mídia com o Skue. O aplicativo para Android TV e o player web estão em testes; as versões para Tizen e WebOS estão planejadas.
                </p>

                <div class="flex flex-col sm:flex-row gap-4 mb-8">
                    <a href="/portal" class="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-sm transition-colors text-base shadow-lg shadow-blue-600/20">
                        Ativar Dispositivo
                    </a>
                    <a href="#download" class="inline-flex items-center justify-center px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white font-medium rounded-sm transition-colors text-base border border-gray-200 dark:border-white/10">
                        Como Instalar
                    </a>
                </div>

                <div class="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 rounded-r-md transition-colors duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500 shrink-0"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    <p class="text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                        O Skue <strong class="text-gray-900 dark:text-white">não fornece canais, filmes, séries ou listas</strong>. Utilize fontes próprias que você tenha autorização para reproduzir.
                    </p>
                </div>
            </div>

            <!-- Right: App Mockup (CSS TV Frame) -->
            <div class="lg:col-span-7 relative perspective-1000">
                <!-- TV Frame (Stays dark to simulate a real screen off/on state) -->
                <div class="relative w-full aspect-video bg-[#0a0a0c] rounded-xl border-[6px] border-gray-300 dark:border-[#222] shadow-[0_30px_60px_rgba(0,0,0,0.2)] dark:shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden transform rotate-y-[-5deg] rotate-x-[2deg] transition-all duration-300">
                    <!-- TV Screen Content (Mock UI) -->
                    <div class="absolute inset-0 bg-[#0f171e] flex flex-col">
                        <!-- UI Header -->
                        <div class="flex items-center justify-between p-4 border-b border-gray-800/50">
                            <div class="flex items-center gap-6">
                                <img src="/images/skue-icon.svg" class="w-8 h-8 rounded-lg shadow-md" alt="Skue" />
                                <div class="flex gap-4">
                                    <div class="h-3 w-16 bg-white/20 rounded"></div>
                                    <div class="h-3 w-24 bg-white/80 rounded"></div>
                                    <div class="h-3 w-20 bg-white/20 rounded"></div>
                                </div>
                            </div>
                            <div class="h-3 w-12 bg-white/10 rounded"></div>
                        </div>
                        <!-- UI Body -->
                        <div class="flex-1 p-4 flex gap-4">
                            <!-- Sidebar -->
                            <div class="w-1/4 flex flex-col gap-3">
                                <div class="h-8 w-full bg-blue-600/20 border-l-2 border-blue-500 rounded-r"></div>
                                <div class="h-8 w-full bg-white/5 rounded"></div>
                                <div class="h-8 w-full bg-white/5 rounded"></div>
                                <div class="h-8 w-full bg-white/5 rounded"></div>
                            </div>
                            <!-- Grid -->
                            <div class="w-3/4 grid grid-cols-4 gap-3">
                                <div class="aspect-[2/3] bg-gradient-to-t from-gray-900 to-gray-800 rounded shadow"></div>
                                <div class="aspect-[2/3] bg-gradient-to-t from-gray-900 to-gray-800 rounded shadow"></div>
                                <div class="aspect-[2/3] bg-gradient-to-t from-gray-900 to-gray-800 rounded shadow"></div>
                                <div class="aspect-[2/3] bg-gradient-to-t from-gray-900 to-gray-800 rounded shadow"></div>
                            </div>
                        </div>
                    </div>
                    <!-- Screen Reflection -->
                    <div class="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none"></div>
                </div>
                <!-- TV Stand -->
                <div class="w-1/3 h-4 bg-gray-300 dark:bg-[#1a1a1a] mx-auto mt-0 rounded-b-md shadow-xl transform rotate-y-[-5deg] transition-colors duration-300"></div>
                <div class="w-1/2 h-2 bg-gray-400 dark:bg-[#222] mx-auto rounded-full mt-1 transform rotate-y-[-5deg] opacity-50 blur-sm transition-colors duration-300"></div>
            </div>

        </div>
    </div>
</section>

<!-- Features / Technical approach -->
<section class="py-24 bg-white dark:bg-[#111216] transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-20 items-center mb-24">
            <div>
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6 transition-colors duration-300">Sua mídia, do seu jeito.</h2>
                <p class="text-gray-600 dark:text-gray-400 text-lg mb-6 leading-relaxed transition-colors duration-300">
                    O Skue reúne recursos de organização e reprodução no seu dispositivo. O funcionamento depende do aparelho, da conexão e das fontes que você adicionar.
                </p>
                <ul class="space-y-4">
                    <li class="flex items-start gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></div>
                        <p class="text-gray-700 dark:text-gray-300 transition-colors duration-300">Organize sua mídia e encontre o que deseja reproduzir.</p>
                    </li>
                    <li class="flex items-start gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></div>
                        <p class="text-gray-700 dark:text-gray-300 transition-colors duration-300">Acesse seus favoritos com facilidade.</p>
                    </li>
                    <li class="flex items-start gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></div>
                        <p class="text-gray-700 dark:text-gray-300 transition-colors duration-300">Retome de onde parou: histórico de reprodução inteligente.</p>
                    </li>
                </ul>
            </div>
            <div class="relative bg-gray-50 dark:bg-[#1a1c23] rounded-lg p-10 border border-gray-200 dark:border-white/5 transition-colors duration-300 shadow-inner">
                <!-- Abstract Technical Graphic -->
                <div class="flex gap-4 h-64 items-end justify-between opacity-70">
                    <div class="w-full bg-blue-500/20 h-[40%] rounded-t-sm relative"><div class="absolute top-0 w-full h-1 bg-blue-500"></div></div>
                    <div class="w-full bg-blue-500/10 h-[60%] rounded-t-sm relative"><div class="absolute top-0 w-full h-1 bg-blue-400"></div></div>
                    <div class="w-full bg-blue-500/30 h-[90%] rounded-t-sm relative"><div class="absolute top-0 w-full h-1 bg-blue-500"></div></div>
                    <div class="w-full bg-blue-500/20 h-[75%] rounded-t-sm relative"><div class="absolute top-0 w-full h-1 bg-blue-400"></div></div>
                    <div class="w-full bg-blue-500/10 h-[50%] rounded-t-sm relative"><div class="absolute top-0 w-full h-1 bg-blue-500"></div></div>
                </div>
                <p class="text-center text-xs text-gray-500 dark:text-gray-600 mt-6 uppercase tracking-widest font-semibold transition-colors duration-300">Organização no seu dispositivo</p>
            </div>
        </div>

    </div>
</section>

<!-- Download Section -->
<section id="download" class="py-20 bg-white dark:bg-[#111216] border-t border-gray-200 dark:border-white/5 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Experimente no seu Android TV ou Google TV.</h2>
            <p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto transition-colors duration-300">O APK está disponível para testes. A compatibilidade deve ser conferida no seu aparelho antes de adotar o aplicativo.</p>
        </div>

        <ul aria-label="Disponibilidade por plataforma" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8">
            <li class="p-4 rounded-lg border border-gray-200 dark:border-white/10">
                <h3 class="font-semibold text-gray-900 dark:text-white">Android TV / Google TV</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Em testes · APK disponível abaixo</p>
            </li>
            <li class="p-4 rounded-lg border border-gray-200 dark:border-white/10">
                <h3 class="font-semibold text-gray-900 dark:text-white">Web</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Player em testes</p>
            </li>
            <li class="p-4 rounded-lg border border-gray-200 dark:border-white/10">
                <h3 class="font-semibold text-gray-900 dark:text-white">Tizen (Samsung)</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Planejado · Sem versão disponível</p>
            </li>
            <li class="p-4 rounded-lg border border-gray-200 dark:border-white/10">
                <h3 class="font-semibold text-gray-900 dark:text-white">WebOS (LG)</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Planejado · Sem versão disponível</p>
            </li>
        </ul>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <!-- Card 1: Download Direto APK -->
            <div class="p-8 bg-gray-50 dark:bg-[#1a1c23] border border-gray-200 dark:border-white/5 rounded-lg flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Instalação Direta (.APK)</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">Baixe o APK de testes e instale via pendrive ou gerenciador de arquivos em um aparelho Android compatível.</p>
                </div>
                <div>
                    <a href="{{ route('download.android') }}" class="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-sm transition-colors text-sm shadow-md shadow-blue-600/20">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                        Baixar Skue TV ({{ config('downloads.android.version') }})
                    </a>
                    <span class="block text-center text-[11px] text-gray-400 mt-2">Versão {{ config('downloads.android.version') }} · Android 7.0+ · {{ number_format(config('downloads.android.size_bytes') / 1048576, 1, ',', '.') }} MiB</span>
                </div>
            </div>

            <!-- Card 2: App Downloader / AFTVnews -->
            <div class="p-8 bg-gray-50 dark:bg-[#1a1c23] border border-gray-200 dark:border-white/5 rounded-lg flex flex-col justify-between">
                <div>
                    <div class="w-12 h-12 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Instalação via App Downloader</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">Abra o aplicativo <strong>Downloader</strong> na sua Smart TV ou Fire TV e digite a URL direta do instalador:</p>
                </div>
                <div class="bg-white dark:bg-[#0c0d10] p-4 rounded border border-gray-200 dark:border-white/10 text-center">
                    <span class="text-xs text-gray-400 uppercase tracking-widest block mb-1">URL Direta no Downloader</span>
                    <code class="text-base font-mono font-bold text-blue-600 dark:text-blue-400 select-all">skue.tv/download/skue-tv.apk</code>
                </div>
            </div>
        </div>
    </div>
</section>

<!-- Pricing -->
<section id="pricing" class="py-24 bg-gray-50 dark:bg-[#0c0d10] border-t border-gray-200 dark:border-[#1a1c23] transition-colors duration-300">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="text-center mb-16">
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Escolha sua licença.</h2>
            <p class="text-gray-600 dark:text-gray-400 transition-colors duration-300">Avalie os recursos do software por 7 dias com sua própria lista.</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-3">A licença é de uso do software. Canais, filmes, séries e listas não estão incluídos.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Free / Trial License -->
            <div class="bg-emerald-500 dark:bg-emerald-600 p-8 border border-emerald-400 dark:border-emerald-500 flex flex-col transition-colors duration-300 shadow-sm rounded-sm">
                <h3 class="text-xl text-white font-medium mb-1 transition-colors duration-300">Teste Grátis</h3>
                <p class="text-sm text-emerald-100 mb-6 transition-colors duration-300">Comece sem compromisso.</p>
                <div class="text-4xl font-bold text-white mb-8 transition-colors duration-300">
                    Free
                </div>
                <div class="flex-1">
                    <div class="h-[1px] w-full bg-emerald-400/50 mb-6 transition-colors duration-300"></div>
                    <ul class="space-y-4 mb-8">
                        <li class="flex text-sm text-white transition-colors duration-300"><span class="mr-3 text-emerald-200">✓</span> 7 dias de avaliação grátis</li>
                        <li class="flex text-sm text-white transition-colors duration-300"><span class="mr-3 text-emerald-200">✓</span> Acesso total aos recursos</li>
                    </ul>
                </div>
                <a href="/portal" class="block w-full py-3 text-center bg-white text-emerald-700 font-bold hover:bg-emerald-50 transition-colors rounded-sm shadow-sm">
                    Testar Agora
                </a>
            </div>

            <!-- Basic License -->
            <div class="bg-white dark:bg-[#111216] p-8 border border-gray-200 dark:border-white/10 flex flex-col transition-colors duration-300 shadow-sm rounded-sm">
                <h3 class="text-xl text-gray-900 dark:text-white font-medium mb-1 transition-colors duration-300">Licença Anual</h3>
                <p class="text-sm text-gray-500 dark:text-gray-500 mb-6 transition-colors duration-300">Validade de 365 dias.</p>
                <div class="text-4xl font-bold text-gray-900 dark:text-white mb-8 transition-colors duration-300">
                    € 4,99
                </div>
                <div class="flex-1">
                    <div class="h-[1px] w-full bg-gray-200 dark:bg-white/5 mb-6 transition-colors duration-300"></div>
                    <ul class="space-y-4 mb-8">
                        <li class="flex text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300"><span class="mr-3 text-blue-500 dark:text-gray-500">✓</span> 1 Dispositivo Ativo</li>
                        <li class="flex text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300"><span class="mr-3 text-blue-500 dark:text-gray-500">✓</span> Atualizações durante a vigência</li>
                    </ul>
                </div>
                <a href="/portal" class="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white font-medium transition-colors rounded-sm">
                    Adquirir Anual
                </a>
            </div>

        </div>

    </div>
</section>
@endsection
