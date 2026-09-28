<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUsersTable extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique(); // selalu lowercase (mutator di model)
            $table->string('password');
            $table->string('role', 32)->default('customer'); // User::ROLES
            $table->string('status', 32)->default('active'); // User::STATUSES
            $table->jsonb('permissions')->nullable(); // kode modul admin; null = tidak ada
            $table->timestampTz('email_verified_at')->nullable();
            $table->timestampTz('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('rejection_reason')->nullable();
            $table->timestampTz('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();
            $table->index(['role', 'status']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('users');
    }
}
