<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Alamat customer (ERD bagian 6): banyak alamat per user, satu is_default per user.
// Kode wilayah 4 level merujuk regions.code dan harus berantai (divalidasi AddressService).
class CreateCustomerAddressesTable extends Migration
{
    public function up()
    {
        Schema::create('customer_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('label', 80);
            $table->string('recipient_name', 120);
            $table->string('phone', 40);
            $table->text('address_line');
            $table->string('province_code', 16);
            $table->string('regency_code', 16);
            $table->string('district_code', 16);
            $table->string('village_code', 16);
            $table->string('postal_code', 10)->nullable();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->text('note')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestampsTz();

            $table->index('user_id');
            $table->foreign('province_code')->references('code')->on('regions')->restrictOnDelete();
            $table->foreign('regency_code')->references('code')->on('regions')->restrictOnDelete();
            $table->foreign('district_code')->references('code')->on('regions')->restrictOnDelete();
            $table->foreign('village_code')->references('code')->on('regions')->restrictOnDelete();
        });
    }

    public function down()
    {
        Schema::dropIfExists('customer_addresses');
    }
}
