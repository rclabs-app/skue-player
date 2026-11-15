<?php

use App\Http\Controllers\PortalController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::view('/contato', 'contact')->name('contact');

foreach (config('legal.documents') as $key => $document) {
    Route::get($document['path'], fn () => view('legal.document', ['document' => config("legal.documents.{$key}")]))
        ->name('legal.'.$key);
}

// Download direto do APK para instalação em Smart TVs (via app Downloader)
Route::get('/download/skue-tv.apk', function () {
    $remoteUrl = config('downloads.android.url');
    if (is_string($remoteUrl) && trim($remoteUrl) !== '') {
        abort_unless(filter_var($remoteUrl, FILTER_VALIDATE_URL)
            && parse_url($remoteUrl, PHP_URL_SCHEME) === 'https', 503);

        return redirect()->away($remoteUrl)->header('Cache-Control', 'no-store');
    }

    $apkPath = public_path('download/skue-tv.apk');
    if (! file_exists($apkPath)) {
        $apkPath = base_path('../download/skue-tv.apk');
    }
    if (! file_exists($apkPath)) {
        abort(404, 'Arquivo de instalação não encontrado.');
    }

    return response()->download($apkPath, 'skue-tv.apk', [
        'Content-Type' => 'application/vnd.android.package-archive',
    ]);
})->name('download.android');

Route::redirect('/downloads/skue-tv.apk', '/download/skue-tv.apk');

// Portal Routes
Route::prefix('portal')->group(function () {
    Route::get('/', [PortalController::class, 'showLoginForm'])->name('portal.login');
    Route::post('/', [PortalController::class, 'login']);
    Route::post('/logout', [PortalController::class, 'logout'])->name('portal.logout');
    Route::get('/dashboard', [PortalController::class, 'dashboard'])->name('portal.dashboard');
    Route::post('/playlists', [PortalController::class, 'storePlaylist'])->name('portal.playlists.store');
    Route::get('/playlists/{id}/edit', [PortalController::class, 'editPlaylist'])->name('portal.playlists.edit');
    Route::put('/playlists/{id}', [PortalController::class, 'updatePlaylist'])->name('portal.playlists.update');
    Route::patch('/playlists/{id}/set-main', [PortalController::class, 'setMainPlaylist'])->name('portal.playlists.set-main');
    Route::delete('/playlists/{id}', [PortalController::class, 'destroyPlaylist'])->name('portal.playlists.destroy');

    // Telas de Retorno do Stripe Checkout
    Route::get('/payment/success', function () {
        return view('portal.payment_success');
    })->name('portal.payment.success');

    Route::get('/payment/cancel', function () {
        return redirect()->route('portal.login')->with('error', 'O pagamento foi cancelado.');
    })->name('portal.payment.cancel');
});
