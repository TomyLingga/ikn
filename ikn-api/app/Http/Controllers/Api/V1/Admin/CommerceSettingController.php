<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CommerceSettingsRequest;
use App\Services\Commerce\CommerceSettings;

// GET/PUT /admin/settings (kontrak 11.5): pengaturan commerce (camelCase). Pengaturan situs ada di /admin/site-settings (A-29).
class CommerceSettingController extends ApiController
{
    public function index(CommerceSettings $settings)
    {
        return $this->data($settings->toApi());
    }

    public function update(CommerceSettingsRequest $request, CommerceSettings $settings)
    {
        return $this->data($settings->update($request->validated()), 200, ['message' => __('api.settings_saved')]);
    }
}
