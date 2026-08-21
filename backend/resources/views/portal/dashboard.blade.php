@extends('layouts.app')

@section('title', 'Painel do Dispositivo - RC Player')

@section('content')
<div x-data="{ showModal: false, playlistType: 'm3u' }" class="min-h-[calc(100vh-250px)] py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111216] transition-colors duration-300">
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

            <!-- Right Column: Playlists -->
            <div class="lg:col-span-2">
                <div class="bg-white dark:bg-[#1a1c23] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/5 transition-colors duration-300">
                    <div class="flex justify-between items-center border-b border-gray-100 dark:border-white/10 pb-3 mb-4 transition-colors duration-300">
                        <h2 class="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">Minhas Playlists</h2>
                        <button @click="showModal = true" class="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 font-medium rounded-sm transition-colors text-xs flex items-center gap-1 shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Adicionar Nova
                        </button>
                    </div>

                    @if($device->playlists->isEmpty())
                        <div class="text-center py-12 px-4 bg-gray-50 dark:bg-[#0c0d10] rounded border border-dashed border-gray-300 dark:border-gray-700 transition-colors duration-300">
                            <div class="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                            </div>
                            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1 transition-colors duration-300">Nenhuma playlist encontrada</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">Você ainda não adicionou nenhuma lista (M3U ou Xtream) para este dispositivo.</p>
                        </div>
                    @else
                        <div class="space-y-3">
                            @foreach($device->playlists as $playlist)
                                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#0c0d10] rounded border border-gray-200 dark:border-white/5 transition-colors duration-300">
                                    <div class="flex-1">
                                        <p class="font-medium text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                            {{ $playlist->name }}
                                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ $playlist->type }}</span>
                                        </p>
                                        <p class="text-xs text-gray-500 mt-1 truncate max-w-sm">{{ $playlist->url }}</p>
                                    </div>
                                    <form action="{{ route('portal.playlists.destroy', $playlist->id) }}" method="POST" onsubmit="return confirm('Tem certeza que deseja remover esta playlist?');">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">Remover</button>
                                    </form>
                                </div>
                            @endforeach
                        </div>
                    @endif
                </div>
            </div>

        </div>
    </div>

    <!-- Add Playlist Modal -->
    <div x-show="showModal" style="display: none;" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <!-- Background overlay -->
            <div x-show="showModal" x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100" x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0" class="fixed inset-0 bg-gray-900/75 backdrop-blur-sm transition-opacity" aria-hidden="true"></div>

            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <!-- Modal panel -->
            <div x-show="showModal" @click.away="showModal = false" x-transition:enter="ease-out duration-300" x-transition:enter-start="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" x-transition:enter-end="opacity-100 translate-y-0 sm:scale-100" x-transition:leave="ease-in duration-200" x-transition:leave-start="opacity-100 translate-y-0 sm:scale-100" x-transition:leave-end="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" class="relative inline-block align-bottom bg-white dark:bg-[#1a1c23] rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-gray-200 dark:border-white/5">
                
                <form action="{{ route('portal.playlists.store') }}" method="POST">
                    @csrf
                    <div class="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div class="flex justify-between items-center mb-5">
                            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white" id="modal-title">Adicionar Nova Playlist</h3>
                            <button type="button" @click="showModal = false" class="text-gray-400 hover:text-gray-500">
                                <span class="sr-only">Fechar</span>
                                <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da Lista</label>
                                <input name="name" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white text-sm" placeholder="Ex: Minha Lista VIP">
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Conexão</label>
                                <div class="flex gap-4">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" value="m3u" x-model="playlistType" class="text-blue-600 focus:ring-blue-500">
                                        <span class="text-sm text-gray-700 dark:text-gray-300">Link M3U</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="type" value="xtream" x-model="playlistType" class="text-blue-600 focus:ring-blue-500">
                                        <span class="text-sm text-gray-700 dark:text-gray-300">Xtream Codes</span>
                                    </label>
                                </div>
                            </div>

                            <!-- M3U Fields -->
                            <div x-show="playlistType === 'm3u'" class="pt-2">
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL (Link M3U)</label>
                                <input name="url" type="url" :required="playlistType === 'm3u'" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white text-sm" placeholder="http://exemplo.com/get.php?username=...&password=...">
                            </div>

                            <!-- Xtream Codes Fields -->
                            <div x-show="playlistType === 'xtream'" class="space-y-4 pt-2" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL do Host (Servidor)</label>
                                    <input name="host" type="url" :required="playlistType === 'xtream'" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white text-sm" placeholder="http://exemplo.com:8080">
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                                        <input name="username" type="text" :required="playlistType === 'xtream'" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white text-sm">
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha</label>
                                        <input name="password" type="password" :required="playlistType === 'xtream'" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white text-sm">
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-[#0c0d10] px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-white/5">
                        <button type="submit" class="w-full inline-flex justify-center rounded-sm border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm">
                            Salvar Playlist
                        </button>
                        <button type="button" @click="showModal = false" class="mt-3 w-full inline-flex justify-center rounded-sm border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-[#1a1c23] text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>
@endsection
