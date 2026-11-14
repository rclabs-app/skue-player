@extends('layouts.app')
@section('title', 'Contato e notificações - Skue')
@section('content')
@php
    $contactEmail = config('contact.email');
    $contactEnabled = config('contact.enabled') && is_string($contactEmail) && filter_var($contactEmail, FILTER_VALIDATE_EMAIL);
@endphp
<main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
    <a href="/" class="text-sm text-blue-600 dark:text-blue-400 underline">Voltar ao início</a>
    <h1 class="text-3xl sm:text-4xl font-semibold text-gray-900 dark:text-white mt-6 mb-4">Contato e notificações</h1>
    <p class="text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">
        Informações para solicitar ajuda com o aplicativo ou comunicar uma questão relacionada ao Skue.
    </p>

    @if($contactEnabled)
        <section aria-labelledby="contact-channel" class="mt-8 p-6 rounded-lg border border-gray-200 dark:border-white/10">
            <h2 id="contact-channel" class="text-xl font-semibold text-gray-900 dark:text-white">Fale com a equipe</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400">Envie sua mensagem para <span class="font-medium break-all">{{ $contactEmail }}</span>.</p>
            <div class="flex flex-col sm:flex-row gap-3 mt-5">
                <a href="mailto:{{ $contactEmail }}?subject={{ rawurlencode('[Skue] Suporte') }}" class="px-5 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-center font-medium">Solicitar suporte</a>
                <a href="mailto:{{ $contactEmail }}?subject={{ rawurlencode('[Skue] Notificação') }}" class="px-5 py-3 rounded border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white text-center font-medium">Enviar notificação</a>
            </div>
            <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Os botões abrem seu aplicativo de e-mail. Esta página não envia mensagens automaticamente.</p>
        </section>
    @else
        <section aria-labelledby="contact-channel" role="status" class="mt-8 p-6 rounded-lg border border-gray-200 dark:border-white/10">
            <h2 id="contact-channel" class="text-xl font-semibold text-gray-900 dark:text-white">Canal em preparação</h2>
            <p class="mt-3 text-gray-600 dark:text-gray-400">O atendimento por este canal ainda não está disponível. As informações de contato serão publicadas aqui quando ele estiver ativo.</p>
        </section>
    @endif

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
        <section aria-labelledby="support-information">
            <h2 id="support-information" class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Ajuda com o aplicativo</h2>
            <p class="text-gray-600 dark:text-gray-400">Para descrever uma dificuldade, informe:</p>
            <ul class="list-disc pl-5 mt-3 space-y-2 text-gray-600 dark:text-gray-400">
                <li>Modelo do aparelho e versão do aplicativo.</li>
                <li>O que tentou fazer e o que aconteceu.</li>
                <li>Quando o problema ocorreu e a mensagem exibida, se houver.</li>
            </ul>
        </section>
        <section aria-labelledby="notification-information">
            <h2 id="notification-information" class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Notificações sobre o Skue</h2>
            <p class="text-gray-600 dark:text-gray-400">Para comunicar uma questão, informe:</p>
            <ul class="list-disc pl-5 mt-3 space-y-2 text-gray-600 dark:text-gray-400">
                <li>Seu nome ou organização e um contato para resposta.</li>
                <li>A página pública ou o recurso do Skue relacionado ao pedido.</li>
                <li>A descrição dos fatos, sua relação com o pedido e a providência solicitada.</li>
            </ul>
        </section>
    </div>
    <section aria-labelledby="contact-privacy" class="mt-10 pt-6 border-t border-gray-200 dark:border-white/10">
        <h2 id="contact-privacy" class="font-semibold text-gray-900 dark:text-white">Cuide dos seus dados</h2>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Não envie senhas, chaves do dispositivo, tokens ou URLs privadas de listas. Em capturas de tela, oculte esses dados. Se algum dado adicional for necessário, a forma de compartilhamento deverá ser combinada antes.</p>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">O Skue não fornece conteúdo ou listas. Solicitações sobre recursos do Skue precisam ser distinguidas de questões sobre fontes externas, que não são administradas pelo aplicativo.</p>
    </section>
</main>
@endsection
