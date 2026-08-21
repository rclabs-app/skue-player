@extends('layouts.app')

@section('title', 'Login do Portal - RC Player')

@section('content')
<div class="min-h-[calc(100vh-250px)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111216] transition-colors duration-300">
    
    <div class="max-w-md w-full space-y-8 bg-white dark:bg-[#1a1c23] p-8 md:p-10 rounded-lg shadow-xl dark:shadow-2xl border border-gray-200 dark:border-white/5 transition-colors duration-300">
        
        <div>
            <h2 class="text-center text-3xl font-extrabold text-gray-900 dark:text-white transition-colors duration-300">
                Acesse seu Dispositivo
            </h2>
            <p class="mt-3 text-center text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                Insira o MAC e a Device Key exibidos na tela principal do RC Player na sua TV.
            </p>
        </div>

        @if($errors->any())
            <div class="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-md transition-colors duration-300">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-red-700 dark:text-red-400 transition-colors duration-300">
                            {{ $errors->first() }}
                        </p>
                    </div>
                </div>
            </div>
        @endif

        <form class="mt-8 space-y-6" action="{{ url('/portal') }}" method="POST">
            @csrf
            
            <div class="space-y-4">
                <div>
                    <label for="mac" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">MAC Address</label>
                    <input id="mac" name="mac" type="text" required class="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white transition-colors duration-300 sm:text-sm" placeholder="Ex: 00:1A:2B:3C:4D:5E" value="{{ old('mac') }}">
                </div>

                <div>
                    <label for="device_key" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors duration-300">Device Key</label>
                    <input id="device_key" name="device_key" type="text" required class="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-[#0c0d10] text-gray-900 dark:text-white transition-colors duration-300 sm:text-sm" placeholder="Ex: A1B2C3">
                </div>
            </div>

            <div>
                <button type="submit" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    Acessar Painel
                </button>
            </div>
        </form>

        <div class="mt-6">
            <p class="text-xs text-center text-gray-500 dark:text-gray-400 transition-colors duration-300">
                A Device Key é sensível a maiúsculas e minúsculas e muda periodicamente para sua segurança.
            </p>
        </div>
    </div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', function() {
        const macInput = document.getElementById('mac');
        
        macInput.addEventListener('input', function(e) {
            // Get current value, remove non-alphanumeric chars
            let val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            
            // Limit to 12 chars
            if (val.length > 12) {
                val = val.substring(0, 12);
            }
            
            // Add colons every 2 chars
            let formatted = '';
            for (let i = 0; i < val.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    formatted += ':';
                }
                formatted += val[i];
            }
            
            // Update input
            e.target.value = formatted;
        });
    });
</script>
@endsection
