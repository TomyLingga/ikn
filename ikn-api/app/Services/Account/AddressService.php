<?php

namespace App\Services\Account;

use App\Models\CustomerAddress;
use App\Models\Region;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Satu pintu alamat customer: rantai wilayah 4 level harus konsisten, is_default tunggal per user,
// alamat pertama otomatis default, hapus alamat default memindahkan default ke alamat lain.
class AddressService
{
    private const REGION_FIELDS = [
        'provinceCode' => Region::LEVEL_PROVINCE,
        'regencyCode' => Region::LEVEL_REGENCY,
        'districtCode' => Region::LEVEL_DISTRICT,
        'villageCode' => Region::LEVEL_VILLAGE,
    ];

    public function create(User $user, array $data): CustomerAddress
    {
        $this->assertRegionChain($data);

        return DB::transaction(function () use ($user, $data) {
            $attributes = $this->attributes($data);
            $makeDefault = ! empty($data['isDefault']) || ! $user->addresses()->exists();

            if ($makeDefault) {
                $user->addresses()->update(['is_default' => false]);
            }

            $attributes['is_default'] = $makeDefault;

            return $user->addresses()->create($attributes);
        });
    }

    public function update(CustomerAddress $address, array $data): CustomerAddress
    {
        $this->assertRegionChain($data);

        return DB::transaction(function () use ($address, $data) {
            $address->fill($this->attributes($data));

            // isDefault=false pada alamat default diabaikan: default hanya berpindah lewat alamat lain.
            if (! empty($data['isDefault']) && ! $address->is_default) {
                CustomerAddress::where('user_id', $address->user_id)->update(['is_default' => false]);
                $address->is_default = true;
            }

            $address->save();

            return $address;
        });
    }

    public function setDefault(CustomerAddress $address): CustomerAddress
    {
        return DB::transaction(function () use ($address) {
            CustomerAddress::where('user_id', $address->user_id)->where('id', '!=', $address->id)->update(['is_default' => false]);
            $address->forceFill(['is_default' => true])->save();

            return $address;
        });
    }

    public function delete(CustomerAddress $address): void
    {
        DB::transaction(function () use ($address) {
            $wasDefault = $address->is_default;
            $userId = $address->user_id;

            $address->delete();

            if ($wasDefault) {
                $next = CustomerAddress::where('user_id', $userId)->orderBy('id')->first();
                $next?->forceFill(['is_default' => true])->save();
            }
        });
    }

    /**
     * Validasi rantai wilayah: village ⊂ district ⊂ regency ⊂ province. Gagal → 422 pada field pertama yang salah.
     *
     * @throws ValidationException
     */
    public function assertRegionChain(array $data): void
    {
        $codes = [];
        foreach (array_keys(self::REGION_FIELDS) as $field) {
            $codes[$field] = (string) ($data[$field] ?? '');
        }

        $regions = Region::query()->whereIn('code', array_values($codes))->get()->keyBy('code');

        $parent = null;
        $parentField = null;

        foreach (self::REGION_FIELDS as $field => $level) {
            $region = $regions->get($codes[$field]);
            $attribute = __('account.attributes.'.$field);

            if (! $region) {
                throw ValidationException::withMessages([$field => [__('account.region_not_found', ['attribute' => $attribute])]]);
            }

            if ($region->level !== $level) {
                throw ValidationException::withMessages([$field => [__('account.region_level_mismatch', [
                    'attribute' => $attribute,
                    'level' => __('account.levels.'.$level),
                ])]]);
            }

            if ($parent !== null && $region->parent_code !== $parent->code) {
                throw ValidationException::withMessages([$field => [__('account.region_chain_invalid', [
                    'attribute' => $attribute,
                    'parent' => __('account.attributes.'.$parentField),
                ])]]);
            }

            $parent = $region;
            $parentField = $field;
        }
    }

    /** camelCase (request) → kolom snake_case. */
    private function attributes(array $data): array
    {
        return [
            'label' => $data['label'],
            'recipient_name' => $data['recipientName'],
            'phone' => $data['phone'],
            'address_line' => $data['addressLine'],
            'province_code' => $data['provinceCode'],
            'regency_code' => $data['regencyCode'],
            'district_code' => $data['districtCode'],
            'village_code' => $data['villageCode'],
            'postal_code' => $data['postalCode'] ?? null,
            'lat' => isset($data['lat']) ? (float) $data['lat'] : null,
            'lng' => isset($data['lng']) ? (float) $data['lng'] : null,
            'note' => $data['note'] ?? null,
        ];
    }
}
