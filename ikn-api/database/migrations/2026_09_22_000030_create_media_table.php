<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMediaTable extends Migration
{
    public function up()
    {
        Schema::create('media', function (Blueprint $table) {
            $table->id();
            $table->string('disk', 16); // public | private
            $table->string('path');
            $table->string('original_name');
            $table->string('mime', 128);
            $table->unsignedBigInteger('size');
            $table->string('collection', 64)->default('general');
            $table->jsonb('meta')->nullable(); // width/height, alt, dll
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
            $table->index('collection');
        });
    }

    public function down()
    {
        Schema::dropIfExists('media');
    }
}
