<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="scroll-smooth">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Skue - Media Player para Smart TV e Android">

    <title>@yield('title', 'Skue - Media Player')</title>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600,700,800&display=swap" rel="stylesheet" />

    <!-- Vite Styles -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])

    <!-- Alpine.js -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

    <!-- Initial Theme Setup (Avoid Flash) -->
    <script>
        if (localStorage.getItem('theme') === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    </script>

    <style>
        /* Base scrollbar and utilities that adapt to light/dark automatically based on Tailwind classes */
        body { transition: background-color 0.3s ease, color 0.3s ease; }
        ::selection { background: rgba(37, 99, 235, 0.3); color: inherit; }
    </style>
</head>
<body class="antialiased font-sans min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-[#0c0d10] dark:text-gray-200" 
      x-data="{ 
          darkMode: localStorage.getItem('theme') === 'dark',
          toggleTheme() {
              this.darkMode = !this.darkMode;
              if (this.darkMode) {
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
              } else {
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('theme', 'light');
              }
          }
      }">

    <!-- Header Navigation -->
    <header class="w-full z-50 bg-white border-b border-gray-200 dark:bg-[#0c0d10] dark:border-white/5 transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-24">
                <!-- Logo -->
                <a href="/" class="flex-shrink-0 flex items-center group py-1" aria-label="Skue - Página Inicial">
                    <svg class="h-10 w-auto text-gray-900 dark:text-white transition-transform group-hover:scale-105 duration-200" viewBox="0 0 200 62" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="header-skue-k-ref" x1="0%" y1="100%" x2="60%" y2="0%">
                                <stop offset="0%" stop-color="#BAE6FD"/>
                                <stop offset="45%" stop-color="#38BDF8"/>
                                <stop offset="100%" stop-color="currentColor" stop-opacity="0.95"/>
                            </linearGradient>
                            <linearGradient id="header-skue-e-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#0284C7"/>
                                <stop offset="50%" stop-color="#0EA5E9"/>
                                <stop offset="100%" stop-color="#00F0FF"/>
                            </linearGradient>
                            <filter id="header-skue-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>
                        <g fill="currentColor">
                            <!-- Letter S -->
                            <path d="M 33.5 14.5 C 31 10.5 26.5 8 20 8 C 11.5 8 6 12.5 6 18.5 C 6 29 32.5 24 32.5 34 C 32.5 40 27 44 19.5 44 C 11.5 44 6.5 39.5 4.5 35.5 L 9.5 32 C 11 35 14.5 38 19.5 38 C 23.5 38 26.5 35.5 26.5 32 C 26.5 23 0 27 0 17 C 0 10 6 2 20 2 C 27.5 2 34 5.5 37.5 11 L 33.5 14.5 Z" />
                            <!-- Letter K -->
                            <rect x="47" y="3" width="6.5" height="40" rx="0.5" />
                            <path d="M 53.5 23.5 L 68 5 L 76.5 5 L 59.5 25.5 Z" />
                            <path d="M 58 23.5 L 74 43 L 83 43 L 64.5 20.5 Z" fill="url(#header-skue-k-ref)" />
                            <!-- Letter U -->
                            <path d="M 94 3 L 100.5 3 L 100.5 28 C 100.5 35 105 38.5 112 38.5 C 119 38.5 123.5 35 123.5 28 L 123.5 3 L 130 3 L 130 28 C 130 39 122.5 44 112 44 C 101.5 44 94 39 94 28 L 94 3 Z" />
                            <!-- Letter E (Top separate bar + bottom connected gradient bracket) -->
                            <rect x="144" y="3" width="32" height="6.5" rx="0.5" />
                            <path d="M 144 19.5 L 171 19.5 L 171 26 L 150.5 26 L 150.5 36.5 L 176 36.5 L 176 43 L 144 43 Z" fill="url(#header-skue-e-grad)" filter="url(#header-skue-glow)" />
                        </g>
                        <!-- Tagline SEE MORE -->
                        <text x="100" y="58" text-anchor="middle" font-family="'Instrument Sans', -apple-system, sans-serif" font-size="6.5" font-weight="600" letter-spacing="7" fill="#64748B" opacity="0.9">SEE MORE</text>
                    </svg>
                </a>
                
                <!-- Desktop Menu & Theme Toggle -->
                <div class="hidden md:flex items-center space-x-8">
                    <a href="/" class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-sm uppercase tracking-widest font-semibold">Início</a>
                    <a href="#pricing" class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors text-sm uppercase tracking-widest font-semibold">Ativação</a>
                    
                    <div class="w-px h-6 bg-gray-300 dark:bg-white/10"></div>
                    
                    <!-- Theme Toggle Button -->
                    <button @click="toggleTheme()" class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors focus:outline-none" aria-label="Alternar tema">
                        <!-- Sun Icon (shows in dark mode, indicating switch to light) -->
                        <svg x-show="darkMode" style="display: none;" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                        <!-- Moon Icon (shows in light mode, indicating switch to dark) -->
                        <svg x-show="!darkMode" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    </button>

                    <a href="/portal" class="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm uppercase tracking-widest font-semibold flex items-center gap-2">
                        Painel do Usuário
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </a>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-grow">
        @yield('content')
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 dark:bg-[#0c0d10] dark:border-white/5 pt-16 pb-8 transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div class="md:col-span-2">
                    <div class="flex items-center gap-3 mb-4">
                        <svg class="h-8 w-auto text-gray-900 dark:text-white" viewBox="0 0 200 62" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="footer-skue-k-ref" x1="0%" y1="100%" x2="60%" y2="0%">
                                    <stop offset="0%" stop-color="#BAE6FD"/>
                                    <stop offset="45%" stop-color="#38BDF8"/>
                                    <stop offset="100%" stop-color="currentColor" stop-opacity="0.95"/>
                                </linearGradient>
                                <linearGradient id="footer-skue-e-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#0284C7"/>
                                    <stop offset="50%" stop-color="#0EA5E9"/>
                                    <stop offset="100%" stop-color="#00F0FF"/>
                                </linearGradient>
                            </defs>
                            <g fill="currentColor">
                                <path d="M 33.5 14.5 C 31 10.5 26.5 8 20 8 C 11.5 8 6 12.5 6 18.5 C 6 29 32.5 24 32.5 34 C 32.5 40 27 44 19.5 44 C 11.5 44 6.5 39.5 4.5 35.5 L 9.5 32 C 11 35 14.5 38 19.5 38 C 23.5 38 26.5 35.5 26.5 32 C 26.5 23 0 27 0 17 C 0 10 6 2 20 2 C 27.5 2 34 5.5 37.5 11 L 33.5 14.5 Z" />
                                <rect x="47" y="3" width="6.5" height="40" rx="0.5" />
                                <path d="M 53.5 23.5 L 68 5 L 76.5 5 L 59.5 25.5 Z" />
                                <path d="M 58 23.5 L 74 43 L 83 43 L 64.5 20.5 Z" fill="url(#footer-skue-k-ref)" />
                                <path d="M 94 3 L 100.5 3 L 100.5 28 C 100.5 35 105 38.5 112 38.5 C 119 38.5 123.5 35 123.5 28 L 123.5 3 L 130 3 L 130 28 C 130 39 122.5 44 112 44 C 101.5 44 94 39 94 28 L 94 3 Z" />
                                <rect x="144" y="3" width="32" height="6.5" rx="0.5" />
                                <path d="M 144 19.5 L 171 19.5 L 171 26 L 150.5 26 L 150.5 36.5 L 176 36.5 L 176 43 L 144 43 Z" fill="url(#footer-skue-e-grad)" />
                            </g>
                            <text x="100" y="58" text-anchor="middle" font-family="'Instrument Sans', -apple-system, sans-serif" font-size="6.5" font-weight="600" letter-spacing="7" fill="#64748B" opacity="0.9">SEE MORE</text>
                        </svg>
                    </div>
                    <p class="text-sm text-gray-500 max-w-sm">
                        O media player definitivo para sua Smart TV. Importante: Nós não fornecemos, distribuímos ou vendemos qualquer tipo de conteúdo, playlists (M3U) ou inscrições.
                    </p>
                </div>
                <div>
                    <h4 class="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Produto</h4>
                    <ul class="space-y-3">
                        <li><a href="#" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Download</a></li>
                        <li><a href="#pricing" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Preços</a></li>
                        <li><a href="/portal" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Ativar Dispositivo</a></li>
                    </ul>
                </div>
                <div>
                    <h4 class="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h4>
                    <ul class="space-y-3">
                        <li><a href="#" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Termos de Uso</a></li>
                        <li><a href="#" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Política de Privacidade</a></li>
                        <li><a href="#" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Aviso Legal (Disclaimer)</a></li>
                    </ul>
                </div>
            </div>
            <div class="border-t border-gray-200 dark:border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <p class="text-xs text-gray-500 dark:text-gray-600">
                    &copy; {{ date('Y') }} Skue. Todos os direitos reservados.
                </p>
                <div class="text-xs text-gray-500 dark:text-gray-600">
                    Software reprodutor de mídia
                </div>
            </div>
        </div>
    </footer>

</body>
</html>
