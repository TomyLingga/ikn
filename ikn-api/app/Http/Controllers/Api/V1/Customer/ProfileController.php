<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\UpdateCompanyRequest;
use App\Http\Requests\Customer\UpdatePasswordRequest;
use App\Http\Requests\Customer\UpdateProfileRequest;
use App\Http\Resources\CustomerProfileResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

// Profil customer (kontrak bagian 4). Profil dibuat bila belum ada (akun lama dari seeder).
class ProfileController extends ApiController
{
    public function show(Request $request)
    {
        return $this->data(new CustomerProfileResource($this->withProfile($request->user())));
    }

    public function update(UpdateProfileRequest $request)
    {
        $user = $this->withProfile($request->user());
        $data = $request->validated();

        DB::transaction(function () use ($user, $data) {
            if (array_key_exists('name', $data)) {
                $user->name = $data['name'];
                $user->save();
            }

            $profile = [];
            if (array_key_exists('phone', $data)) {
                $profile['phone'] = $data['phone'];
            }
            if (array_key_exists('position', $data)) {
                $profile['position'] = $data['position'];
            }
            if ($profile !== []) {
                $user->profile->fill($profile)->save();
            }
        });

        return $this->data(new CustomerProfileResource($user->fresh()), 200, ['message' => __('account.profile_updated')]);
    }

    public function updateCompany(UpdateCompanyRequest $request)
    {
        $user = $this->withProfile($request->user());
        $data = $request->validated();

        $map = ['company' => 'company', 'companyEmail' => 'company_email', 'companyPhone' => 'company_phone', 'taxId' => 'tax_id'];
        $profile = [];
        foreach ($map as $input => $column) {
            if (array_key_exists($input, $data)) {
                $profile[$column] = $data[$input];
            }
        }

        // Negara dan alamat perusahaan menentukan pasar yang dikunci admin (ASUMSI A-86): customer hanya boleh
        // mengubahnya selagi akun pending; setelah itu nilai yang berbeda ditolak 422 (nilai sama diabaikan).
        $locked = ['countryCode' => 'country_code', 'companyAddress' => 'company_address'];
        $errors = [];
        foreach ($locked as $input => $column) {
            if (! array_key_exists($input, $data)) {
                continue;
            }
            $value = $data[$input];
            if ($input === 'countryCode') {
                $value = $value ?: \App\Models\CustomerProfile::DEFAULT_COUNTRY;
            } elseif (is_string($value)) {
                $value = trim($value) === '' ? null : trim($value);
            }
            $current = $user->profile->{$column};
            if ($input === 'countryCode') {
                $current = $current ?: \App\Models\CustomerProfile::DEFAULT_COUNTRY;
            }
            if ($value === $current) {
                continue;
            }
            if ($user->status !== User::STATUS_PENDING) {
                $errors[$input] = [__('account.company_locked')];
                continue;
            }
            $profile[$column] = $value;
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        if ($profile !== []) {
            $user->profile->fill($profile)->save();
        }

        return $this->data(new CustomerProfileResource($user->fresh()), 200, ['message' => __('account.profile_updated')]);
    }

    public function updatePassword(UpdatePasswordRequest $request)
    {
        $user = $request->user();

        if (! Hash::check($request->input('currentPassword'), $user->password)) {
            throw ValidationException::withMessages(['currentPassword' => [__('account.current_password_wrong')]]);
        }

        $user->forceFill(['password' => Hash::make($request->input('password'))])->save();

        return $this->data(['ok' => true], 200, ['message' => __('account.password_updated')]);
    }

    private function withProfile(User $user): User
    {
        $user->loadMissing('profile');

        if (! $user->profile) {
            $user->setRelation('profile', $user->profile()->create([]));
        }

        return $user;
    }
}
