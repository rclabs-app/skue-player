<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SubscriptionResource\Pages;
use App\Models\Subscription;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class SubscriptionResource extends Resource
{
    protected static ?string $model = Subscription::class;

    protected static ?string $navigationIcon = 'heroicon-o-credit-card';

    protected static ?string $navigationLabel = 'Assinaturas';

    protected static ?string $modelLabel = 'Assinatura';

    protected static ?string $pluralModelLabel = 'Assinaturas';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Vínculo da Assinatura')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Select::make('device_id')
                            ->label('Dispositivo (MAC)')
                            ->relationship('device', 'mac')
                            ->searchable()
                            ->required(),
                        Forms\Components\Select::make('customer_id')
                            ->label('Cliente')
                            ->relationship('customer', 'name')
                            ->searchable(),
                    ]),

                Forms\Components\Section::make('Detalhes do Plano')
                    ->columns(3)
                    ->schema([
                        Forms\Components\Select::make('type')
                            ->label('Tipo de Licença')
                            ->options([
                                'monthly' => 'Mensal',
                                'yearly' => 'Anual (1 Ano)',
                                'lifetime' => 'Vitalícia (Perpétua)',
                            ])
                            ->required()
                            ->default('yearly'),
                        Forms\Components\Select::make('status')
                            ->label('Status')
                            ->options([
                                'active' => 'Ativa',
                                'expired' => 'Expirada',
                                'cancelled' => 'Cancelada',
                            ])
                            ->required()
                            ->default('active'),
                        Forms\Components\TextInput::make('payment_method')
                            ->label('Forma de Pagamento')
                            ->default('pix'),
                        Forms\Components\DateTimePicker::make('starts_at')
                            ->label('Início')
                            ->required()
                            ->default(now()),
                        Forms\Components\DateTimePicker::make('expires_at')
                            ->label('Expira em (vazio para vitalício)'),
                        Forms\Components\TextInput::make('amount_cents')
                            ->label('Valor (Centavos)')
                            ->numeric()
                            ->default(0)
                            ->prefix('R$')
                            ->formatStateUsing(fn ($state) => $state ? number_format($state / 100, 2, ',', '.') : '0,00'),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('device.mac')
                    ->label('Dispositivo MAC')
                    ->fontFamily('mono')
                    ->searchable()
                    ->sortable(),
                Tables\Columns\TextColumn::make('customer.name')
                    ->label('Cliente')
                    ->searchable()
                    ->placeholder('-'),
                Tables\Columns\TextColumn::make('type')
                    ->label('Plano')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'monthly' => 'Mensal',
                        'yearly' => 'Anual',
                        'lifetime' => 'Vitalícia',
                        default => $state,
                    })
                    ->colors([
                        'info' => 'monthly',
                        'success' => 'yearly',
                        'warning' => 'lifetime',
                    ]),
                Tables\Columns\TextColumn::make('status')
                    ->label('Status')
                    ->badge()
                    ->colors([
                        'success' => 'active',
                        'danger' => 'expired',
                        'gray' => 'cancelled',
                    ]),
                Tables\Columns\TextColumn::make('starts_at')
                    ->label('Início')
                    ->date('d/m/Y')
                    ->sortable(),
                Tables\Columns\TextColumn::make('expires_at')
                    ->label('Expira em')
                    ->date('d/m/Y')
                    ->placeholder('Nunca (Vitalícia)')
                    ->sortable(),
                Tables\Columns\TextColumn::make('payment_method')
                    ->label('Método')
                    ->badge(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('type')
                    ->options([
                        'monthly' => 'Mensal',
                        'yearly' => 'Anual',
                        'lifetime' => 'Vitalícia',
                    ]),
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'active' => 'Ativa',
                        'expired' => 'Expirada',
                        'cancelled' => 'Cancelada',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
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
            'index' => Pages\ListSubscriptions::route('/'),
            'create' => Pages\CreateSubscription::route('/create'),
            'edit' => Pages\EditSubscription::route('/{record}/edit'),
        ];
    }
}
