<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCustomerLogosTable extends Migration
{
    public function up()
    {
        Schema::create('customer_logos', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_logos');
    }
}
