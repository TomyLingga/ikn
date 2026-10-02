<?php

namespace Tests\Feature\Commerce;

use App\Models\Media;
use App\Models\Order;
use App\Models\UserNotification;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Lampiran order dari admin (ASUMSI A-74): unggah pada order yang sudah dibayar, customer pemilik bisa mengunduh, hapus.
class OrderAttachmentTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_admin_attaches_documents_and_owner_can_download_them(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $pending = $this->placeOrder($this->makeProduct([], 10), 1);
        $paid = $this->payOrder($this->placeOrder($this->makeProduct([], 10), 1));
        $admin = $this->adminWith(['orders'], ['name' => 'Admin Gudang']);
        $url = fn (Order $o) => '/api/v1/admin/orders/'.$o->number.'/attachments';

        // Belum dibayar → 409.
        $this->actingAs($admin)->post($url($pending), ['file' => UploadedFile::fake()->create('faktur.pdf', 50, 'application/pdf')])
            ->assertStatus(409)->assertJsonPath('code', 'ATTACHMENT_NOT_ALLOWED');

        // Jenis berkas di luar daftar → 415; sukses → 201 dengan attachments[] + notifikasi customer.
        $this->actingAs($admin)->post($url($paid), ['file' => UploadedFile::fake()->create('virus.exe', 10, 'application/x-msdownload')])->assertStatus(415);
        // Dokumen hanya PDF (2026-10-03): berkas Office ditolak.
        $this->actingAs($admin)->post($url($paid), ['file' => UploadedFile::fake()->create('rekap.xlsx', 10, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')])->assertStatus(415);
        $this->actingAs($admin)->post($url($paid), ['file' => UploadedFile::fake()->create('faktur-pajak.pdf', 50, 'application/pdf'), 'label' => 'Faktur Pajak 010.000-26.00000001'])
            ->assertStatus(201)
            ->assertJsonCount(1, 'data.attachments')
            ->assertJsonPath('data.attachments.0.label', 'Faktur Pajak 010.000-26.00000001')
            ->assertJsonPath('data.attachments.0.file.originalName', 'faktur-pajak.pdf')
            ->assertJsonPath('data.attachments.0.file.mime', 'application/pdf')
            ->assertJsonPath('data.attachments.0.actor.name', 'Admin Gudang')
            ->assertJsonPath('data.canAttach', true);
        $this->actingAs($admin)->post($url($paid), ['file' => UploadedFile::fake()->image('surat-jalan.jpg')])->assertStatus(201)->assertJsonCount(2, 'data.attachments');

        $media = Media::where('collection', 'order-attachments')->orderBy('id')->first();
        $this->assertSame(Media::DISK_PRIVATE, $media->disk);
        Storage::disk('private')->assertExists($media->path);
        $this->assertSame(1, UserNotification::where('user_id', $this->buyer->id)->where('type', 'order.attachment')->where('body->id', 'like', '%Faktur Pajak%')->count());

        // Dikirim: lampiran ikut saat status diubah (urutan: ubah status lalu unggah) tetap diizinkan.
        $sm = app(OrderStateMachine::class);
        $sm->transition($paid, Order::STATUS_PROCESSING, $admin);
        $sm->transition($paid, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X1']);
        $this->actingAs($admin)->post($url($paid), ['file' => UploadedFile::fake()->create('resi.pdf', 10, 'application/pdf')])->assertStatus(201)->assertJsonCount(3, 'data.attachments');

        // Customer pemilik melihat dan mengunduh; customer lain tidak.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$paid->number)->assertOk()->assertJsonCount(3, 'data.attachments');
        $this->actingAs($this->buyer)->fromFrontend()->get('/api/v1/files/'.$media->id)->assertOk();
        $this->app['auth']->forgetGuards();
        $other = $this->customer(['email' => 'lain@example.com']);
        $this->actingAs($other)->fromFrontend()->get('/api/v1/files/'.$media->id)->assertStatus(403);

        // Hapus: baris dan berkas hilang; id milik order lain → 404.
        $this->app['auth']->forgetGuards();
        $first = $paid->fresh()->attachments()->first();
        $this->actingAs($admin)->deleteJson($url($paid).'/'.$first->id)->assertOk()->assertJsonCount(2, 'data.attachments');
        $this->assertDatabaseMissing('media', ['id' => $media->id]);
        Storage::disk('private')->assertMissing($media->path);
        $this->actingAs($admin)->deleteJson($url($pending).'/'.$paid->fresh()->attachments()->first()->id)->assertStatus(404);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->post($url($paid), ['file' => UploadedFile::fake()->create('x.pdf', 1, 'application/pdf')])->assertStatus(403);
    }
}
