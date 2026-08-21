<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pairing_codes', function (Blueprint $table) {
            $table->string('code', 6)->primary();
            $table->text('payload')->nullable(); // encrypted config from browser
            $table->integer('attempts')->default(0);
            $table->boolean('consumed')->default(false);
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pairing_codes');
    }
};
