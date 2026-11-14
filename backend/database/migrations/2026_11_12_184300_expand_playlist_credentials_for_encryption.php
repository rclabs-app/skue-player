<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('device_playlists', function (Blueprint $table) {
            $table->text('username')->nullable()->change();
            $table->text('password')->nullable()->change();
        });
        Schema::table('pairing_codes', function (Blueprint $table) {
            $table->mediumText('payload')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Retain TEXT: shrinking encrypted values to VARCHAR could truncate data.
    }
};
