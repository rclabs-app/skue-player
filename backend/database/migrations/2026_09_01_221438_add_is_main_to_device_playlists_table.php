<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('device_playlists', function (Blueprint $table) {
            $table->boolean('is_main')->default(false)->after('is_active');
        });

        // Set the first playlist of each device as main
        $devices = \Illuminate\Support\Facades\DB::table('devices')->pluck('id');
        foreach ($devices as $deviceId) {
            $firstPlaylist = \Illuminate\Support\Facades\DB::table('device_playlists')
                ->where('device_id', $deviceId)
                ->orderBy('created_at', 'asc')
                ->first();
            
            if ($firstPlaylist) {
                \Illuminate\Support\Facades\DB::table('device_playlists')
                    ->where('id', $firstPlaylist->id)
                    ->update(['is_main' => true]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('device_playlists', function (Blueprint $table) {
            $table->dropColumn('is_main');
        });
    }
};
