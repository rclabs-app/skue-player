<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PortalController;

Route::get('/', function () {
    return view('welcome');
});

// Portal Routes
Route::prefix('portal')->group(function () {
    Route::get('/', [PortalController::class, 'showLoginForm'])->name('portal.login');
    Route::post('/', [PortalController::class, 'login']);
    Route::post('/logout', [PortalController::class, 'logout'])->name('portal.logout');
    Route::get('/dashboard', [PortalController::class, 'dashboard'])->name('portal.dashboard');
    Route::post('/playlists', [PortalController::class, 'storePlaylist'])->name('portal.playlists.store');
    Route::delete('/playlists/{id}', [PortalController::class, 'destroyPlaylist'])->name('portal.playlists.destroy');
});
