<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocLinksTable extends Migration
{
    public function up()
    {
        Schema::create('doc_links', function (Blueprint $table) {
            $table->id();
            $table->string('category', 64); // key item menu induk, mis. "keberlanjutan"; "wbs" untuk SOP WBS
            $table->jsonb('label');
            $table->jsonb('description')->nullable();
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('url')->nullable(); // tautan eksternal bila bukan file
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
            $table->index(['category', 'is_active']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('doc_links');
    }
}
