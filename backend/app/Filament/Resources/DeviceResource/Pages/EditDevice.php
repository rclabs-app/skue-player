<?php

namespace App\Filament\Resources\DeviceResource\Pages;

use App\Filament\Resources\DeviceResource;
use Filament\Actions;
use App\Models\Device;
use Filament\Forms\Components\TextInput;
use Illuminate\Validation\Rule;
use Filament\Resources\Pages\EditRecord;

class EditDevice extends EditRecord
{
    protected static string $resource = DeviceResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make()
                ->label('Excluir dispositivo')
                ->keyBindings([])
                ->modalHeading('Excluir dispositivo permanentemente?')
                ->modalDescription(fn (Device $record): string =>
                    'Dispositivo: '.($record->name ?: 'Sem nome').'. MAC: '.$record->mac.
                    '. Listas vinculadas: '.$record->playlists()->count().
                    '. O cadastro e suas listas serão excluídos. O app perderá a configuração ao sincronizar '.
                    'e precisará ser configurado novamente pelo portal. Esta ação não pode ser desfeita.')
                ->modalSubmitActionLabel('Excluir definitivamente')
                ->modalCancelActionLabel('Cancelar')
                ->form([
                    TextInput::make('confirmation_mac')
                        ->label('Digite o MAC do dispositivo para confirmar')
                        ->helperText('Digite exatamente o MAC exibido acima, incluindo os dois-pontos.')
                        ->required()
                        ->autocomplete(false)
                        ->rules(fn (Device $record): array => [Rule::in([$record->fresh()->mac])])
                        ->validationMessages([
                            'required' => 'Digite o MAC para confirmar a exclusão.',
                            'in' => 'O MAC informado não corresponde ao dispositivo.',
                        ]),
                ]),
        ];
    }
}
