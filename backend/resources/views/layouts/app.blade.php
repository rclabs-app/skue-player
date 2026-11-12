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
                    <svg class="h-10 w-auto text-gray-900 dark:text-white transition-transform group-hover:scale-105 duration-200" viewBox="20 12 205 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="header-skue-wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stop-color="#00F0FF"/>
                                <stop offset="35%" stop-color="#0EA5E9"/>
                                <stop offset="70%" stop-color="#2563EB"/>
                                <stop offset="100%" stop-color="#8B5CF6"/>
                            </linearGradient>
                            <linearGradient id="header-skue-e-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#BAE6FD"/>
                                <stop offset="50%" stop-color="#38BDF8"/>
                                <stop offset="100%" stop-color="#00F0FF"/>
                            </linearGradient>
                            <filter id="header-skue-wave-glow" x="-20%" y="-50%" width="140%" height="200%">
                                <feGaussianBlur stdDeviation="2.5" result="blur1" />
                                <feGaussianBlur stdDeviation="0.8" result="blur2" />
                                <feMerge>
                                    <feMergeNode in="blur1" />
                                    <feMergeNode in="blur2" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        <g fill="currentColor" transform="translate(5, -5)">
                            <path d="m 55.947266,22.636719 v 9.257812 q -3.603516,-1.611328 -7.03125,-2.43164 -3.427735,-0.820313 -6.650391,-0.820313 -4.335938,0 -6.591797,1.523438 -2.226563,1.49414 -2.226563,4.335937 0,2.402344 1.699219,3.75 1.728516,1.31836 5.888672,2.490235 l 5.830078,1.640625 q 8.085938,2.255859 11.660156,5.771484 3.574219,3.486328 3.574219,9.404297 0,7.998047 -5.478515,12.304688 -5.478516,4.30664 -15.585938,4.30664 -4.833984,0 -9.609375,-1.113281 -4.746094,-1.142578 -9.140625,-3.36914 v -9.902344 q 4.658203,2.43164 9.169922,3.691406 4.541015,1.259766 8.876953,1.259766 4.628906,0 7.03125,-1.699219 2.43164,-1.728516 2.43164,-4.746094 0,-2.607422 -1.757812,-4.072266 -1.728516,-1.464843 -6.298829,-2.724609 l -5.419921,-1.523437 q -7.587891,-2.167969 -10.957032,-5.507813 -3.36914,-3.369141 -3.36914,-9.052734 0,-7.382813 5.361328,-11.601563 5.390625,-4.248047 14.882813,-4.248047 4.248046,0 8.52539,0.761719 4.277344,0.732422 8.769532,2.255859 z" />
                            <path d="M 72.720703,21.259766 H 84 v 15.966796 l 16.25977,-15.966796 h 14.70703 L 95.962891,38.632812 116.14844,64.21875 H 101.44141 L 84,41.972656 V 64.21875 H 72.720703 Z" />
                            <path d="m 122.16016,21.259766 h 11.27929 v 26.220703 q 0,5.419922 1.99219,8.085938 2.02149,2.666015 6.44531,2.666015 4.45313,0 6.44532,-2.666015 2.02148,-2.666016 2.02148,-8.085938 V 21.259766 h 11.2793 v 25.86914 q 0,10.634766 -5.39063,15.644532 -5.39062,4.980468 -14.35547,4.980468 -8.96484,0 -14.35547,-4.980468 -5.36132,-5.009766 -5.36132,-15.644532 z" />
                            <path d="m 174.88086,21.259766 h 30.43945 v 8.52539 h -19.16015 v 8.115235 h 17.51953 v 8.378906 h -17.51953 v 9.404297 h 19.86328 v 8.535156 h -31.14258 z" />
                            <rect x="193" y="21.26" width="12" height="8.5" rx="0.5" fill="url(#header-skue-e-shine)" />
                        </g>
                        <path d="M 32 68 C 65 67, 95 73, 120 74 C 150 75, 175 70, 195 68 C 205 67, 212 68, 216 71 C 210 73.5, 195 72, 175 73.5 C 145 76, 120 77.5, 95 75.5 C 65 73, 45 69.5, 32 68 Z" fill="url(#header-skue-wave-grad)" filter="url(#header-skue-wave-glow)" />
                        <text x="124" y="88" text-anchor="middle" font-family="'Instrument Sans', -apple-system, sans-serif" font-size="8.5" font-weight="600" letter-spacing="9" fill="#94A3B8" opacity="0.95">SEE MORE</text>
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
                        <svg class="h-8 w-auto text-gray-900 dark:text-white" viewBox="20 12 205 78" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="footer-skue-wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stop-color="#00F0FF"/>
                                    <stop offset="35%" stop-color="#0EA5E9"/>
                                    <stop offset="70%" stop-color="#2563EB"/>
                                    <stop offset="100%" stop-color="#8B5CF6"/>
                                </linearGradient>
                                <linearGradient id="footer-skue-e-shine" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#BAE6FD"/>
                                    <stop offset="50%" stop-color="#38BDF8"/>
                                    <stop offset="100%" stop-color="#00F0FF"/>
                                </linearGradient>
                                <filter id="footer-skue-wave-glow" x="-20%" y="-50%" width="140%" height="200%">
                                    <feGaussianBlur stdDeviation="2.5" result="blur1" />
                                    <feGaussianBlur stdDeviation="0.8" result="blur2" />
                                    <feMerge>
                                        <feMergeNode in="blur1" />
                                        <feMergeNode in="blur2" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            </defs>
                            <g fill="currentColor" transform="translate(5, -5)">
                                <path d="m 55.947266,22.636719 v 9.257812 q -3.603516,-1.611328 -7.03125,-2.43164 -3.427735,-0.820313 -6.650391,-0.820313 -4.335938,0 -6.591797,1.523438 -2.226563,1.49414 -2.226563,4.335937 0,2.402344 1.699219,3.75 1.728516,1.31836 5.888672,2.490235 l 5.830078,1.640625 q 8.085938,2.255859 11.660156,5.771484 3.574219,3.486328 3.574219,9.404297 0,7.998047 -5.478515,12.304688 -5.478516,4.30664 -15.585938,4.30664 -4.833984,0 -9.609375,-1.113281 -4.746094,-1.142578 -9.140625,-3.36914 v -9.902344 q 4.658203,2.43164 9.169922,3.691406 4.541015,1.259766 8.876953,1.259766 4.628906,0 7.03125,-1.699219 2.43164,-1.728516 2.43164,-4.746094 0,-2.607422 -1.757812,-4.072266 -1.728516,-1.464843 -6.298829,-2.724609 l -5.419921,-1.523437 q -7.587891,-2.167969 -10.957032,-5.507813 -3.36914,-3.369141 -3.36914,-9.052734 0,-7.382813 5.361328,-11.601563 5.390625,-4.248047 14.882813,-4.248047 4.248046,0 8.52539,0.761719 4.277344,0.732422 8.769532,2.255859 z" />
                                <path d="M 72.720703,21.259766 H 84 v 15.966796 l 16.25977,-15.966796 h 14.70703 L 95.962891,38.632812 116.14844,64.21875 H 101.44141 L 84,41.972656 V 64.21875 H 72.720703 Z" />
                                <path d="m 122.16016,21.259766 h 11.27929 v 26.220703 q 0,5.419922 1.99219,8.085938 2.02149,2.666015 6.44531,2.666015 4.45313,0 6.44532,-2.666015 2.02148,-2.666016 2.02148,-8.085938 V 21.259766 h 11.2793 v 25.86914 q 0,10.634766 -5.39063,15.644532 -5.39062,4.980468 -14.35547,4.980468 -8.96484,0 -14.35547,-4.980468 -5.36132,-5.009766 -5.36132,-15.644532 z" />
                                <path d="m 174.88086,21.259766 h 30.43945 v 8.52539 h -19.16015 v 8.115235 h 17.51953 v 8.378906 h -17.51953 v 9.404297 h 19.86328 v 8.535156 h -31.14258 z" />
                                <rect x="193" y="21.26" width="12" height="8.5" rx="0.5" fill="url(#footer-skue-e-shine)" />
                            </g>
                            <path d="M 32 68 C 65 67, 95 73, 120 74 C 150 75, 175 70, 195 68 C 205 67, 212 68, 216 71 C 210 73.5, 195 72, 175 73.5 C 145 76, 120 77.5, 95 75.5 C 65 73, 45 69.5, 32 68 Z" fill="url(#footer-skue-wave-grad)" filter="url(#footer-skue-wave-glow)" />
                            <text x="124" y="88" text-anchor="middle" font-family="'Instrument Sans', -apple-system, sans-serif" font-size="8.5" font-weight="600" letter-spacing="9" fill="#94A3B8" opacity="0.95">SEE MORE</text>
                        </svg>
                    </div>
                    <p class="text-sm text-gray-500 max-w-sm">
                        Software para organizar e reproduzir suas próprias listas de mídia. A licença de uso não inclui canais, filmes, séries ou listas. O Skue não fornece nem vende conteúdo ou fontes de reprodução.
                    </p>
                </div>
                <div>
                    <h4 class="text-gray-900 dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Produto</h4>
                    <ul class="space-y-3">
                        <li><a href="#download" class="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Download</a></li>
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
