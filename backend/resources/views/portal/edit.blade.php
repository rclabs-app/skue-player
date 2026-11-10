@extends('layouts.app')
@section('title', 'Editar lista - Skue')
@section('content')
<div class="max-w-2xl mx-auto py-12 px-4">
    <a href="{{ route('portal.dashboard') }}" class="text-blue-600 dark:text-blue-400 underline text-sm">Voltar ao painel</a>
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white mt-4 mb-6">Editar lista</h1>
    @if($errors->any())
        <div role="alert" class="mb-5 p-4 border rounded text-red-700 dark:text-red-400 border-red-400">
            <ul class="list-disc pl-5">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul>
        </div>
    @endif
    <form action="{{ route('portal.playlists.update', $playlist->id) }}" method="POST" class="p-6 bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-white/10 rounded-lg">
        @csrf
        @method('PUT')
        @include('portal.playlist_form')
        <button type="submit" class="mt-5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded">Salvar alterações</button>
    </form>
</div>
@endsection
