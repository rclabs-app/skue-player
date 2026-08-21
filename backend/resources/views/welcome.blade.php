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
                    O RC Player é um reprodutor rápido, organizado e livre de anúncios para Smart TVs, Android e Web. Eleve sua experiência de visualização sem complicações.
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
                        O RC Player <strong class="text-gray-900 dark:text-white">não fornece conteúdo</strong>. Você deve ter sua própria lista.
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
                                <div class="w-8 h-8 rounded bg-blue-600"></div>
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
                <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-6 transition-colors duration-300">Desempenho sob o capô.</h2>
                <p class="text-gray-600 dark:text-gray-400 text-lg mb-6 leading-relaxed transition-colors duration-300">
                    Esqueça aplicativos lentos que demoram para processar sua lista. Construímos o RC Player com um motor local moderno, garantindo que a navegação seja fluída independente do tamanho do catálogo.
                </p>
                <ul class="space-y-4">
                    <li class="flex items-start gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></div>
                        <p class="text-gray-700 dark:text-gray-300 transition-colors duration-300">Organização automática por categorias (VOD, Séries, Ao Vivo).</p>
                    </li>
                    <li class="flex items-start gap-3">
                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></div>
                        <p class="text-gray-700 dark:text-gray-300 transition-colors duration-300">Guia de programação EPG sincronizado em tempo real.</p>
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
                <p class="text-center text-xs text-gray-500 dark:text-gray-600 mt-6 uppercase tracking-widest font-semibold transition-colors duration-300">Renderização Ultra-Rápida</p>
            </div>
        </div>

    </div>
</section>

<!-- Pricing -->
<section id="pricing" class="py-24 bg-gray-50 dark:bg-[#0c0d10] border-t border-gray-200 dark:border-[#1a1c23] transition-colors duration-300">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div class="text-center mb-16">
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-300">Escolha seu acesso.</h2>
            <p class="text-gray-600 dark:text-gray-400 transition-colors duration-300">7 dias grátis em qualquer dispositivo. Sem compromisso inicial.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <li class="flex text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300"><span class="mr-3 text-blue-500 dark:text-gray-500">✓</span> Atualizações Inclusas</li>
                    </ul>
                </div>
                <a href="/portal" class="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white font-medium transition-colors rounded-sm">
                    Adquirir Anual
                </a>
            </div>

            <!-- Lifetime License -->
            <div class="bg-blue-600 p-8 flex flex-col relative shadow-lg shadow-blue-600/20 rounded-sm">
                <div class="absolute top-0 right-0 bg-blue-800 dark:bg-[#0c0d10] text-blue-100 dark:text-gray-300 text-[10px] font-bold px-3 py-1 uppercase tracking-wider transition-colors duration-300 rounded-bl-sm">Único Pagamento</div>
                <h3 class="text-xl text-white font-medium mb-1">Vitalícia</h3>
                <p class="text-sm text-blue-200 mb-6">Acesso para sempre.</p>
                <div class="text-4xl font-bold text-white mb-8">
                    € 9,99
                </div>
                <div class="flex-1">
                    <div class="h-[1px] w-full bg-blue-500 mb-6"></div>
                    <ul class="space-y-4 mb-8">
                        <li class="flex text-sm text-blue-50"><span class="mr-3 text-blue-300">✓</span> 1 Dispositivo Ativo</li>
                        <li class="flex text-sm text-blue-50"><span class="mr-3 text-blue-300">✓</span> Atualizações Inclusas</li>
                        <li class="flex text-sm text-blue-50"><span class="mr-3 text-blue-300">✓</span> Sem cobranças recorrentes</li>
                    </ul>
                </div>
                <a href="/portal" class="block w-full py-3 text-center bg-white text-blue-900 font-bold hover:bg-gray-100 transition-colors rounded-sm">
                    Adquirir Vitalícia
                </a>
            </div>
        </div>

    </div>
</section>
@endsection
