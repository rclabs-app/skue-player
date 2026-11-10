@extends('layouts.app')

@section('title', 'Painel do Dispositivo - Skue')

@section('content')
<div class="min-h-[calc(100vh-250px)] py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111216] transition-colors duration-300">
    <div class="max-w-5xl mx-auto">
        
        <!-- Header Dashboard -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-300">Gerenciamento do Dispositivo</h1>
                <p class="text-gray-600 dark:text-gray-400 mt-1 transition-colors duration-300">Gerencie suas playlists e assinatura do dispositivo vinculado.</p>
            </div>
            <form action="{{ route('portal.logout') }}" method="POST">
                @csrf
                <button type="submit" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-sm transition-colors text-sm shadow-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    Desconectar
                </button>
            </form>
        </div>

        @if(session('success'))
            <div class="mb-8 bg-green-50 dark:bg-green-500/10 border-l-4 border-green-500 p-4 rounded-r-md transition-colors duration-300">
                <p class="text-sm text-green-700 dark:text-green-400 font-medium">
                    {{ session('success') }}
                </p>
            </div>
        @endif

        @if($errors->any())
            <div class="mb-8 bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md transition-colors duration-300">
                <p class="text-sm text-red-700 dark:text-red-400 font-medium">
                    {{ $errors->first() }}
                </p>
            </div>
        @endif

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            <!-- Left Column: Device Info -->
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-white dark:bg-[#1a1c23] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/5 transition-colors duration-300">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-white/10 pb-3 mb-4 transition-colors duration-300">Informações do Dispositivo</h2>
                    
                    <div class="space-y-4">
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1 transition-colors duration-300">MAC Address</p>
                            <p class="text-lg text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-[#0c0d10] px-3 py-2 rounded border border-gray-200 dark:border-white/5 transition-colors duration-300">
                                {{ $device->mac }}
                            </p>
                        </div>
                        
                        <div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold mb-1 transition-colors duration-300">Status da Licença</p>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="w-2.5 h-2.5 rounded-full {{ $device->isKeyExpired() ? 'bg-red-500' : 'bg-emerald-500' }}"></span>
                                <span class="text-sm font-medium text-gray-900 dark:text-white transition-colors duration-300">
                                    {{ $device->isKeyExpired() ? 'Expirada' : 'Ativa' }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 transition-colors duration-300">
                        <a href="/portal#renovar" class="block w-full py-2 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-sm transition-colors text-sm">
                            Renovar Licença
                        </a>
                    </div>
                </div>
            </div>

            <div class="lg:col-span-2 space-y-6">
                <section class="bg-white dark:bg-[#1a1c23] p-6 rounded-lg border border-gray-200 dark:border-white/5" aria-labelledby="playlists-title">
                    <h2 id="playlists-title" class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Minhas Playlists</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">A principal será escolhida ao configurar o aplicativo. Listas desativadas não são enviadas ao aparelho.</p>
                    @forelse($device->playlists as $playlist)
                        <article class="p-4 mb-3 bg-gray-50 dark:bg-[#0c0d10] rounded border border-gray-200 dark:border-white/10">
                            <h3 class="font-semibold text-gray-900 dark:text-white break-words">{{ $playlist->name }}</h3>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {{ strtoupper($playlist->type) }} · {{ $playlist->is_active ? 'Ativa' : 'Desativada' }}
                                @if($playlist->is_main) · <strong>Principal</strong> @endif
                            </p>
                            <div class="flex flex-wrap items-center gap-4 mt-4 text-sm">
                                <a href="{{ route('portal.playlists.edit', $playlist->id) }}" class="text-blue-600 dark:text-blue-400 underline">Editar lista</a>
                                @if($playlist->is_active && !$playlist->is_main)
                                    <form action="{{ route('portal.playlists.set-main', $playlist->id) }}" method="POST">
                                        @csrf
                                        @method('PATCH')
                                        <button type="submit" class="text-blue-600 dark:text-blue-400 underline">Definir como principal</button>
                                    </form>
                                @endif
                                <form action="{{ route('portal.playlists.destroy', $playlist->id) }}" method="POST" onsubmit="return confirm('Tem certeza que deseja remover esta playlist?');">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="text-red-600 dark:text-red-400 underline">Remover</button>
                                </form>
                            </div>
                        </article>
                    @empty
                        <p class="py-6 text-sm text-gray-500 dark:text-gray-400">Nenhuma lista cadastrada. Adicione sua primeira lista abaixo.</p>
                    @endforelse
                </section>
                <details class="bg-white dark:bg-[#1a1c23] p-6 rounded-lg border border-gray-200 dark:border-white/5" @if($errors->any() || $device->playlists->isEmpty()) open @endif>
                    <summary class="font-semibold cursor-pointer text-gray-900 dark:text-white">Adicionar nova lista</summary>
                    <form action="{{ route('portal.playlists.store') }}" method="POST" class="mt-5">
                        @csrf
                        @include('portal.playlist_form', ['playlist' => null])
                        <button type="submit" class="mt-5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded">Adicionar lista</button>
                    </form>
                </details>
            </div>
        </div>
    </div>
</div>
@endsection
