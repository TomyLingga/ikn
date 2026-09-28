<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

// Manajemen akun admin (super_admin saja).
class UserController extends ApiController
{
    public function index()
    {
        return $this->data(AdminUserResource::collection(User::admins()->orderBy('name')->get()));
    }

    public function modules(ModuleAccess $access)
    {
        $modules = [];
        foreach ($access->modules() as $code => $name) {
            $modules[] = ['code' => $code, 'name' => $name];
        }

        return $this->data($modules);
    }

    public function store(StoreUserRequest $request)
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'status' => ($data['active'] ?? true) ? User::STATUS_ACTIVE : User::STATUS_INACTIVE,
            'permissions' => $data['role'] === User::ROLE_SUPER_ADMIN ? null : array_values($data['permissions'] ?? []),
            'email_verified_at' => now(),
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
        ]);

        return $this->created(new AdminUserResource($user));
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        if (! $user->isAdmin()) {
            throw ApiException::notFound();
        }

        $data = $request->validated();

        if ($user->id === $request->user()->id && array_key_exists('active', $data) && ! $data['active']) {
            throw ValidationException::withMessages(['active' => [__('api.cannot_deactivate_self')]]);
        }

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $user->email = $data['email'];
        }
        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }
        if (array_key_exists('role', $data)) {
            $user->role = $data['role'];
        }
        if (array_key_exists('active', $data)) {
            $user->status = $data['active'] ? User::STATUS_ACTIVE : User::STATUS_INACTIVE;
        }
        if (array_key_exists('permissions', $data)) {
            $user->permissions = array_values($data['permissions'] ?? []);
        }
        if ($user->role === User::ROLE_SUPER_ADMIN) {
            $user->permissions = null;
        }

        $user->save();

        return $this->data(new AdminUserResource($user->fresh()));
    }
}
