<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

// Kategori berita terkelola (tabel post_categories, CRUD admin) menggantikan kolom teks bebas posts.tag.
// Nilai tag yang ada dipindahkan menjadi kategori (nama id = en = tag) lalu kolom tag dihapus.
class CreatePostCategoriesTable extends Migration
{
    public function up(): void
    {
        Schema::create('post_categories', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->jsonb('name'); // { id, en }
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->constrained('post_categories')->nullOnDelete();
            $table->index('category_id');
        });

        $tags = DB::table('posts')->whereNotNull('tag')->where('tag', '!=', '')->distinct()->orderBy('tag')->pluck('tag');
        foreach ($tags as $position => $tag) {
            $base = Str::slug($tag) ?: 'kategori';
            $slug = $base;
            $i = 2;
            while (DB::table('post_categories')->where('slug', $slug)->exists()) {
                $slug = $base.'-'.$i++;
            }
            $id = DB::table('post_categories')->insertGetId([
                'slug' => $slug,
                'name' => json_encode(['id' => $tag, 'en' => $tag], JSON_UNESCAPED_UNICODE),
                'sort_order' => $position,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('posts')->where('tag', $tag)->update(['category_id' => $id]);
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('tag');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('tag', 64)->nullable();
        });

        foreach (DB::table('post_categories')->get(['id', 'name']) as $category) {
            $name = json_decode($category->name, true) ?: [];
            DB::table('posts')->where('category_id', $category->id)->update(['tag' => $name['id'] ?? null]);
        }

        Schema::table('posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('category_id');
        });

        Schema::dropIfExists('post_categories');
    }
}
