<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Profil customer (ERD bagian 6): satu baris per user role customer, PK = user_id.
class CreateCustomerProfilesTable extends Migration
{
    public function up()
    {
        Schema::create('customer_profiles', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('company', 160)->nullable();
            $table->string('position', 120)->nullable();
            $table->string('company_email', 190)->nullable();
            $table->string('company_phone', 40)->nullable();
            $table->string('tax_id', 40)->nullable(); // NPWP
            $table->string('phone', 40)->nullable();
            $table->timestampsTz();
            $table->primary('user_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_profiles');
    }
}
