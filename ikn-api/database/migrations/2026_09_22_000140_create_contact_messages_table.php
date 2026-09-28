<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateContactMessagesTable extends Migration
{
    public function up()
    {
        Schema::create('contact_messages', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16)->default('contact'); // contact | quote
            $table->string('name');
            $table->string('email');
            $table->string('phone', 64)->nullable();
            $table->string('subject')->nullable();
            $table->text('message');
            $table->jsonb('meta')->nullable();
            $table->timestampTz('read_at')->nullable();
            $table->timestampsTz();
            $table->index(['read_at', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('contact_messages');
    }
}
