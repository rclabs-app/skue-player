<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('terms_acceptances', function (Blueprint $table) {
            // Nullable preserves historical rows; new requests must supply a UUID.
            $table->uuid('acceptance_id')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('terms_acceptances', function (Blueprint $table) {
            $table->dropUnique(['acceptance_id']);
            $table->dropColumn('acceptance_id');
        });
    }
};
