<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSettingsTable extends Migration
{
    public function up()
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('key', 128)->primary(); // "company.name"
            $table->jsonb('value')->nullable();
            $table->string('group', 64)->index();
            $table->boolean('is_public')->default(false);
            $table->timestampsTz();
        });
    }

    public function down()
    {
        Schema::dropIfExists('settings');
    }
}
