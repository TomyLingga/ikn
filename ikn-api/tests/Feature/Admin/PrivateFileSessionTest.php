<?php

namespace Tests\Feature\Admin;

use App\Models\Media;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// GET /files/{media} dibuka langsung di tab browser (tanpa Origin/Referer FE) oleh pengguna yang sudah login:
// middleware session.downloads menyalakan sesi sehingga cookie login dikenali (bukti bayar, lampiran WBS).
class PrivateFileSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_logged_in_admin_can_open_private_file_without_frontend_headers(): void
    {
        Storage::fake('private');
        Storage::disk('private')->put('proofs/bukti.pdf', '%PDF-1.4 bukti');
        $media = Media::create(['disk' => 'private', 'path' => 'proofs/bukti.pdf', 'original_name' => 'bukti.pdf', 'mime' => 'application/pdf', 'size' => 14]);
        $this->superAdmin(['email' => 'admin@ptikn.com']); // password bawaan factory: "password"

        // Tanpa login: tetap ditolak walau sesi dinyalakan.
        $this->get('/api/v1/files/'.$media->id)->assertStatus(401);

        // Login lewat FE (stateful) dan simpan cookie yang dikirim server, seperti browser.
        $login = $this->fromFrontend()->postJson('/api/v1/auth/admin/login', ['email' => 'admin@ptikn.com', 'password' => 'password'])->assertOk();
        $cookies = [];
        foreach ($login->headers->getCookies() as $cookie) {
            $cookies[$cookie->getName()] = $cookie->getValue();
        }
        $this->assertArrayHasKey(config('session.cookie'), $cookies);

        // Permintaan baru tanpa Origin/Referer (tab baru, rel=noreferrer) hanya membawa cookie sesi.
        $this->forgetRequestState();
        $this->withUnencryptedCookies($cookies)->get('/api/v1/files/'.$media->id)
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');

        // Cookie sesi asal-asalan tidak memberi akses.
        $this->forgetRequestState();
        $this->withUnencryptedCookies([config('session.cookie') => 'bukan-sesi'])->get('/api/v1/files/'.$media->id)
            ->assertStatus(401);
    }

    /**
     * Test memakai satu instance aplikasi untuk semua permintaan. Kosongkan guard dan isi sesi di memori agar
     * login benar-benar dipulihkan dari cookie (seperti proses PHP baru), bukan sisa permintaan sebelumnya.
     */
    private function forgetRequestState(): void
    {
        $this->app['auth']->forgetGuards();
        $this->app['session.store']->flush();
        $this->flushHeaders();
    }
}
