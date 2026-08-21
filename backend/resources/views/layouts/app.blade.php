<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="scroll-smooth">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="RC Player - Media Player for Smart TV and Android">

    <title>@yield('title', 'RC Player')</title>

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
                <a href="/" class="flex-shrink-0 flex items-center gap-3 group">
                    <div class="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                    <span class="text-gray-900 dark:text-white font-extrabold text-2xl tracking-tighter group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">RC PLAYER</span>
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
                        <div class="w-6 h-6 bg-blue-600 flex items-center justify-center rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </div>
                        <span class="text-gray-900 dark:text-white font-bold tracking-tight">RC PLAYER</span>
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
                    &copy; {{ date('Y') }} RC Player. Todos os direitos reservados.
                </p>
                <div class="text-xs text-gray-500 dark:text-gray-600">
                    Software reprodutor de mídia
                </div>
            </div>
        </div>
    </footer>

</body>
</html>
