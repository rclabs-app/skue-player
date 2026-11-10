<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('removed_devices', function (Blueprint $table) {
            $table->string('identifier_hash', 64)->primary();
            $table->timestamp('removed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('removed_devices');
    }
};
