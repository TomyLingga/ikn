<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateWbsReportsTable extends Migration
{
    public function up()
    {
        Schema::create('wbs_reports', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique(); // WBS-YYYYMM-NNNN
            $table->string('subject');
            $table->text('body');
            $table->string('reporter_name')->nullable();
            $table->string('reporter_contact')->nullable();
            $table->boolean('is_anonymous')->default(true);
            $table->foreignId('attachment_media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->string('status', 16)->default('new'); // WbsReport::STATUSES
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('admin_notes')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('wbs_reports');
    }
}
