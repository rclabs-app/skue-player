@php
    $playlist = $playlist ?? null;
@endphp
<div class="space-y-4" x-data="{ playlistType: @js(old('type', $playlist?->type ?? 'm3u')) }">
    <div>
        <label for="playlist-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da lista</label>
        <input id="playlist-name" name="name" value="{{ old('name', $playlist?->name) }}" required maxlength="100" class="w-full px-3 py-2 border rounded bg-white dark:bg-[#0c0d10] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
    </div>
    <div>
        <label for="playlist-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de conexão</label>
        <select id="playlist-type" name="type" x-model="playlistType" class="w-full px-3 py-2 border rounded bg-white dark:bg-[#0c0d10] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
            <option value="m3u" @selected(old('type', $playlist?->type ?? 'm3u') === 'm3u')>Link M3U</option>
            <option value="xtream" @selected(old('type', $playlist?->type) === 'xtream')>Conta Xtream</option>
        </select>
    </div>
    <div>
        <label for="playlist-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL da lista M3U ou servidor Xtream</label>
        <input id="playlist-url" name="url" type="url" value="{{ old('url', $playlist?->url) }}" required maxlength="2048" placeholder="https://exemplo.com" class="w-full px-3 py-2 border rounded bg-white dark:bg-[#0c0d10] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
    </div>
    <div x-show="playlistType === 'xtream'" class="space-y-4">
        <div>
            <label for="playlist-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário da conta Xtream</label>
            <input id="playlist-username" name="username" value="{{ old('username', $playlist?->username) }}" maxlength="255" autocomplete="off" class="w-full px-3 py-2 border rounded bg-white dark:bg-[#0c0d10] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
        </div>
        <div>
            <label for="playlist-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha da conta Xtream</label>
            <input id="playlist-password" name="password" type="password" maxlength="255" autocomplete="new-password" aria-describedby="password-help" class="w-full px-3 py-2 border rounded bg-white dark:bg-[#0c0d10] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
            <p id="password-help" class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ $playlist?->type === 'xtream' ? 'Deixe em branco para manter a senha atual.' : 'Obrigatória para uma nova conta Xtream.' }}</p>
        </div>
    </div>
    <div class="text-sm text-gray-700 dark:text-gray-300">
        <input type="hidden" name="is_active" value="0">
        <label class="flex gap-2 items-center"><input type="checkbox" name="is_active" value="1" @checked(old('is_active', $playlist?->is_active ?? true))> Lista ativa no dispositivo</label>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Ao desativar a principal, outra lista ativa será escolhida, se houver.</p>
    </div>
</div>
