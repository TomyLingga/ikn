<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Services\Cms\SettingsService;
use Illuminate\Http\Request;

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
}
