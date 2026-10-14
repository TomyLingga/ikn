<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\MailTestRequest;
use App\Mail\TestMail;
use App\Services\Cms\SettingsService;
use App\Services\Mail\MailConfigurator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SettingController extends ApiController
{
    public function index(SettingsService $settings)
    {
        return $this->data($settings->all());
    }

    public function update(Request $request, SettingsService $settings)
    {
        $all = $settings->update($request->all());

        return $this->data($all, 200, ['message' => __('api.settings_saved')]);
    }

    /**
     * Kirim email uji (sinkron) memakai pengaturan di form (`mail`, belum disimpan) atau yang tersimpan.
     * Gagal transport → 422 MAIL_TEST_FAILED dengan alasan dari server SMTP; mode off → 422 MAIL_DISABLED.
     */
    public function testMail(MailTestRequest $request, MailConfigurator $configurator)
    {
        $to = strtolower($request->validated()['to']);
        $override = $request->validated()['mail'] ?? null;

        $mode = $configurator->refresh($override);
        if ($mode === MailConfigurator::MODE_OFF) {
            $configurator->refresh();
            throw new ApiException(422, 'MAIL_DISABLED', __('api.mail_disabled'));
        }

        $info = $configurator->describe($mode);
        $via = $mode === MailConfigurator::MODE_SMTP ? 'SMTP '.$info['host'] : __('api.mail_via_server');

        try {
            Mail::to($to)->send(new TestMail($request->user(), $via));
        } catch (Throwable $e) {
            throw new ApiException(422, 'MAIL_TEST_FAILED', __('api.mail_test_failed', ['reason' => $e->getMessage()]));
        } finally {
            $configurator->refresh(); // kembali ke pengaturan tersimpan
        }

        return $this->data($info + ['to' => $to], 200, ['message' => __('api.mail_test_sent', ['to' => $to])]);
    }
}
