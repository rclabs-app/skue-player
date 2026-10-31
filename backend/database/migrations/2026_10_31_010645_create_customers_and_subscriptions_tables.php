<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable()->index();
            $table->string('whatsapp')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('id')->constrained('customers')->nullOnDelete();
            $table->string('status', 20)->default('trial')->after('name')->index(); // trial, active, expired, blocked
            $table->timestamp('trial_ends_at')->nullable()->after('status');
            $table->string('device_model')->nullable()->after('trial_ends_at');
            $table->string('app_version')->nullable()->after('device_model');
            $table->string('ip_address', 45)->nullable()->after('app_version');
            $table->timestamp('last_seen_at')->nullable()->after('ip_address');
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->string('type', 20)->default('yearly'); // monthly, yearly, lifetime
            $table->string('status', 20)->default('active')->index(); // active, expired, cancelled
            $table->timestamp('starts_at');
            $table->timestamp('expires_at')->nullable(); // null for lifetime
            $table->unsignedInteger('amount_cents')->default(0);
            $table->string('payment_method', 50)->default('manual'); // pix, credit_card, manual
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
        
        Schema::table('devices', function (Blueprint $table) {
            $table->dropForeign(['customer_id']);
            $table->dropColumn([
                'customer_id',
                'status',
                'trial_ends_at',
                'device_model',
                'app_version',
                'ip_address',
                'last_seen_at',
            ]);
        });

        Schema::dropIfExists('customers');
    }
};
