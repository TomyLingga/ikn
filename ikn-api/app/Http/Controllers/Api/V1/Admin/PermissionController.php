<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Services\Auth\ModuleAccess;
use Illuminate\Http\Request;

class PermissionController extends ApiController
{
    public function self(Request $request, ModuleAccess $access)
    {
        $user = $request->user();

        return $this->data([
            'role' => $user->role,
            'modules' => $access->allowedFor($user),
        ]);
    }
}
