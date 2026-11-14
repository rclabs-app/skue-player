@extends('layouts.app')
@section('title', $document['title'] . ' — Skue')
@section('content')
<article class="max-w-4xl mx-auto px-6 py-12 space-y-8 text-gray-700 dark:text-gray-300">
    <header class="space-y-3">
        <a href="/" class="underline focus-visible:ring-2">Voltar ao início</a>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ $document['title'] }}</h1>
        <p class="font-medium">{{ config('legal.status') }}</p>
        <p class="text-sm">Versão {{ config('legal.version') }} · 12/11/2026</p>
    </header>
    <nav aria-label="Documentos" class="flex flex-wrap gap-5 underline">
        @foreach(config('legal.documents') as $item)
            <a href="{{ $item['path'] }}">{{ $item['title'] }}</a>
        @endforeach
        <a href="{{ route('contact') }}">Contato e notificações</a>
    </nav>
    @foreach($document['sections'] as $section)
        <section class="space-y-2">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ $section['title'] }}</h2>
            <p class="leading-relaxed">{{ $section['text'] }}</p>
        </section>
    @endforeach
</article>
@endsection
