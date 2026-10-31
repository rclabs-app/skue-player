<?php

namespace App\Filament\Widgets;

use App\Models\Customer;
use App\Models\Device;
use App\Models\Subscription;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $totalDevices = Device::count();
        $activeDevices = Device::where('status', 'active')->count();
        $trialDevices = Device::where('status', 'trial')->count();
        $expiredDevices = Device::where('status', 'expired')->count();
        $totalCustomers = Customer::count();

        return [
            Stat::make('Total de Dispositivos', $totalDevices)
                ->description('Dispositivos conectados ao Skue')
                ->icon('heroicon-o-tv')
                ->color('primary'),

            Stat::make('Dispositivos Licenciados', $activeDevices)
                ->description('Licenças anuais e vitalícias ativas')
                ->icon('heroicon-o-check-circle')
                ->color('success'),

            Stat::make('Em Período de Testes', $trialDevices)
                ->description('Clientes testando o player')
                ->icon('heroicon-o-clock')
                ->color('info'),

            Stat::make('Licenças Expiradas', $expiredDevices)
                ->description('Oportunidades de renovação')
                ->icon('heroicon-o-exclamation-triangle')
                ->color('danger'),

            Stat::make('Clientes Cadastrados', $totalCustomers)
                ->description('Base de clientes')
                ->icon('heroicon-o-users')
                ->color('gray'),
        ];
    }
}
