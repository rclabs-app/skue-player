<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_device_registrations', function (Blueprint $table) {
            $table->id();
            $table->string('mac', 50)->unique();
            $table->string('device_key', 6)->unique();
            $table->string('name', 100)->nullable();
            $table->string('device_model', 100)->nullable();
            $table->string('app_version', 50)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_device_registrations');
    }
};
