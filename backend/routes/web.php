<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PortalController;

Route::get('/', function () {
    return view('welcome');
});

// Download direto do APK para instalação em Smart TVs (via app Downloader)
Route::get('/download/skue-tv.apk', function () {
    $apkPath = public_path('download/skue-tv.apk');
    if (!file_exists($apkPath)) {
        $apkPath = base_path('../download/skue-tv.apk');
    }
    if (!file_exists($apkPath)) {
        abort(404, 'Arquivo de instalação não encontrado.');
    }
    return response()->download($apkPath, 'skue-tv.apk', [
        'Content-Type' => 'application/vnd.android.package-archive',
    ]);
});

// Portal Routes
Route::prefix('portal')->group(function () {
    Route::get('/', [PortalController::class, 'showLoginForm'])->name('portal.login');
    Route::post('/', [PortalController::class, 'login']);
    Route::post('/logout', [PortalController::class, 'logout'])->name('portal.logout');
    Route::get('/dashboard', [PortalController::class, 'dashboard'])->name('portal.dashboard');
    Route::post('/playlists', [PortalController::class, 'storePlaylist'])->name('portal.playlists.store');
    Route::delete('/playlists/{id}', [PortalController::class, 'destroyPlaylist'])->name('portal.playlists.destroy');

    // Telas de Retorno do Stripe Checkout
    Route::get('/payment/success', function () {
        return view('portal.payment_success');
    })->name('portal.payment.success');

    Route::get('/payment/cancel', function () {
        return redirect()->route('portal.login')->with('error', 'O pagamento foi cancelado.');
    })->name('portal.payment.cancel');
});
