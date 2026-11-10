<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DeviceResource\Pages;
use App\Models\Device;
use App\Models\Subscription;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Carbon;

class DeviceResource extends Resource
{
    protected static ?string $model = Device::class;

    protected static ?string $navigationIcon = 'heroicon-o-tv';

    protected static ?string $navigationLabel = 'Dispositivos';

    protected static ?string $modelLabel = 'Dispositivo';

    protected static ?string $pluralModelLabel = 'Dispositivos';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Identificação do Dispositivo')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('mac')
                            ->label('MAC Address')
                            ->required()
                            ->unique(ignoreRecord: true),
                        Forms\Components\TextInput::make('device_key')
                            ->label('Device Key (6 dígitos)')
                            ->required()
                            ->maxLength(6),
                        Forms\Components\TextInput::make('name')
                            ->label('Apelido / Descrição')
                            ->placeholder('Ex: TV da Sala'),
                        Forms\Components\Select::make('customer_id')
                            ->label('Cliente Proprietário')
                            ->relationship('customer', 'name')
                            ->searchable()
                            ->preload(),
                    ]),

                Forms\Components\Section::make('Status da Licença')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Select::make('status')
                            ->label('Status')
                            ->options([
                                'trial' => 'Em Teste (Trial)',
                                'active' => 'Ativo / Licenciado',
                                'expired' => 'Expirado',
                                'blocked' => 'Bloqueado',
                            ])
                            ->required()
                            ->default('trial'),
                        Forms\Components\DateTimePicker::make('trial_ends_at')
                            ->label('Término do Período de Testes'),
                    ]),

                Forms\Components\Section::make('Informações de Conexão')
                    ->collapsed()
                    ->columns(3)
                    ->schema([
                        Forms\Components\TextInput::make('device_model')
                            ->label('Modelo de Dispositivo')
                            ->disabled(),
                        Forms\Components\TextInput::make('app_version')
                            ->label('Versão do App')
                            ->disabled(),
                        Forms\Components\TextInput::make('ip_address')
                            ->label('Último IP')
                            ->disabled(),
                        Forms\Components\DateTimePicker::make('last_seen_at')
                            ->label('Última Atividade')
                            ->disabled(),
                        Forms\Components\DateTimePicker::make('key_expires_at')
                            ->label('Expiração da Chave')
                            ->default(now()->addYears(100)),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('mac')
                    ->label('MAC')
                    ->fontFamily('mono')
                    ->searchable()
                    ->copyable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('device_key')
                    ->label('Key')
                    ->badge()
                    ->color('gray')
                    ->fontFamily('mono')
                    ->copyable(),
                Tables\Columns\TextColumn::make('name')
                    ->label('Nome / Local')
                    ->searchable()
                    ->placeholder('-'),
                Tables\Columns\TextColumn::make('customer.name')
                    ->label('Cliente')
                    ->searchable()
                    ->placeholder('Não atribuído'),
                Tables\Columns\TextColumn::make('status')
                    ->label('Licença')
                    ->badge()
                    ->colors([
                        'info' => 'trial',
                        'success' => 'active',
                        'warning' => 'expired',
                        'danger' => 'blocked',
                    ])
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'trial' => 'Em Teste',
                        'active' => 'Ativo',
                        'expired' => 'Expirado',
                        'blocked' => 'Bloqueado',
                        default => $state,
                    }),
                Tables\Columns\TextColumn::make('days_remaining')
                    ->label('Dias Restantes')
                    ->state(fn (Device $record): string => $record->daysRemaining() === 9999 ? 'Vitalício' : $record->daysRemaining() . ' dias')
                    ->badge()
                    ->color(fn (Device $record): string => $record->daysRemaining() > 7 ? 'success' : ($record->daysRemaining() > 0 ? 'warning' : 'danger')),
                Tables\Columns\TextColumn::make('playlists_count')
                    ->counts('playlists')
                    ->label('Listas M3U')
                    ->badge(),
                Tables\Columns\TextColumn::make('last_seen_at')
                    ->label('Visto por Último')
                    ->since()
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->label('Status da Licença')
                    ->options([
                        'trial' => 'Em Teste',
                        'active' => 'Ativo',
                        'expired' => 'Expirado',
                        'blocked' => 'Bloqueado',
                    ]),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    // Ação Rápida: Ativar por 1 Ano
                    Tables\Actions\Action::make('activate_one_year')
                        ->label('Ativar por 1 Ano')
                        ->icon('heroicon-o-check-badge')
                        ->color('success')
                        ->requiresConfirmation()
                        ->action(function (Device $record) {
                            $startsAt = Carbon::now();
                            $expiresAt = Carbon::now()->addYear();

                            Subscription::create([
                                'device_id' => $record->id,
                                'customer_id' => $record->customer_id,
                                'type' => 'yearly',
                                'status' => 'active',
                                'starts_at' => $startsAt,
                                'expires_at' => $expiresAt,
                                'amount_cents' => 0,
                                'payment_method' => 'manual',
                                'notes' => 'Ativação anual manual realizada pelo painel.',
                            ]);

                            $record->update([
                                'status' => 'active',
                            ]);

                            Notification::make()
                                ->title('Licença ativada por 1 ano!')
                                ->success()
                                ->send();
                        }),

                    // Ação Rápida: Ativar Vitalício
                    Tables\Actions\Action::make('activate_lifetime')
                        ->label('Ativar Vitalício')
                        ->icon('heroicon-o-sparkles')
                        ->color('warning')
                        ->requiresConfirmation()
                        ->action(function (Device $record) {
                            Subscription::create([
                                'device_id' => $record->id,
                                'customer_id' => $record->customer_id,
                                'type' => 'lifetime',
                                'status' => 'active',
                                'starts_at' => Carbon::now(),
                                'expires_at' => null,
                                'amount_cents' => 0,
                                'payment_method' => 'manual',
                                'notes' => 'Ativação vitalícia realizada pelo painel.',
                            ]);

                            $record->update([
                                'status' => 'active',
                            ]);

                            Notification::make()
                                ->title('Licença Vitalícia concedida com sucesso!')
                                ->success()
                                ->send();
                        }),

                    // Prorrogar Trial (+7 dias)
                    Tables\Actions\Action::make('extend_trial')
                        ->label('Prorrogar Teste (+7 dias)')
                        ->icon('heroicon-o-clock')
                        ->action(function (Device $record) {
                            $baseDate = ($record->trial_ends_at && $record->trial_ends_at->isFuture()) 
                                ? $record->trial_ends_at 
                                : Carbon::now();

                            $record->update([
                                'status' => 'trial',
                                'trial_ends_at' => $baseDate->addDays(7),
                            ]);

                            Notification::make()
                                ->title('Período de teste prorrogado por 7 dias!')
                                ->info()
                                ->send();
                        }),

                    // Bloquear / Desbloquear
                    Tables\Actions\Action::make('toggle_block')
                        ->label(fn (Device $record): string => $record->status === 'blocked' ? 'Desbloquear' : 'Bloquear')
                        ->icon('heroicon-o-no-symbol')
                        ->color('danger')
                        ->requiresConfirmation()
                        ->action(function (Device $record) {
                            $newStatus = $record->status === 'blocked' ? 'active' : 'blocked';
                            $record->update(['status' => $newStatus]);

                            Notification::make()
                                ->title("Dispositivo {$newStatus} com sucesso!")
                                ->send();
                        }),

                    // Resetar Device Key
                    Tables\Actions\Action::make('reset_key')
                        ->label('Resetar Device Key')
                        ->icon('heroicon-o-key')
                        ->requiresConfirmation()
                        ->action(function (Device $record) {
                            $oldKey = $record->device_key;
                            $newKey = Device::generateUniqueKey();
                            $record->update([
                                'device_key' => $newKey,
                                'key_expires_at' => Carbon::now()->addYears(100),
                            ]);

                            Notification::make()
                                ->title("Chave resetada de {$oldKey} para {$newKey}")
                                ->warning()
                                ->send();
                        }),

                    Tables\Actions\EditAction::make(),
                ]),
            ])
            ->bulkActions([]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDevices::route('/'),
            'create' => Pages\CreateDevice::route('/create'),
            'edit' => Pages\EditDevice::route('/{record}/edit'),
        ];
    }
}
