<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePagesAndSectionsTables extends Migration
{
    public function up()
    {
        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 128)->unique();
            $table->jsonb('title'); // {id,en}
            $table->string('status', 16)->default('draft'); // Page::STATUSES
            $table->jsonb('seo')->nullable(); // { title:{id,en}, description:{id,en} }
            $table->string('template', 64)->default('default');
            $table->timestampsTz();
        });

        Schema::create('page_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('page_id')->constrained('pages')->cascadeOnDelete();
            $table->string('key', 64)->nullable(); // alias stabil, mis. "history"
            $table->string('type', 64); // SectionRegistry
            $table->unsignedInteger('sort_order')->default(0);
            $table->jsonb('content');
            $table->boolean('is_visible')->default(true);
            $table->timestampsTz();
            $table->unique(['page_id', 'key']);
            $table->index(['page_id', 'sort_order']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('page_sections');
        Schema::dropIfExists('pages');
    }
}
