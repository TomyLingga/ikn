<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateBrochuresTable extends Migration
{
    public function up()
    {
        Schema::create('brochures', function (Blueprint $table) {
            $table->id();
            $table->jsonb('title');
            $table->jsonb('description')->nullable();
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->boolean('is_published')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
        });
    }

    public function down()
    {
        Schema::dropIfExists('brochures');
    }
}
