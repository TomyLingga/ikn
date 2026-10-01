<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Sasaran customer untuk voucher dan biaya tambahan (ASUMSI A-67).
 * audience = all → berlaku untuk semua customer; customers → hanya yang ada di tabel pivot.
 * Model pemakai mendefinisikan AUDIENCE_PIVOT (nama tabel pivot) dan AUDIENCE_KEY (kolom FK-nya).
 */
trait HasCustomerAudience
{
    public function customers()
    {
        return $this->belongsToMany(User::class, static::AUDIENCE_PIVOT, static::AUDIENCE_KEY, 'user_id');
    }

    public function isForAllCustomers(): bool
    {
        return $this->audience !== self::AUDIENCE_CUSTOMERS;
    }

    public function eligibleFor(User $user): bool
    {
        return $this->isForAllCustomers() || $this->customers()->whereKey($user->id)->exists();
    }

    /** Baris yang berlaku untuk customer ini: sasaran semua, atau customer terdaftar di pivot. */
    public function scopeForCustomer(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $w) use ($user) {
            $w->where('audience', self::AUDIENCE_ALL)
                ->orWhereHas('customers', fn (Builder $c) => $c->whereKey($user->id));
        });
    }

    public function scopeForEveryone(Builder $query): Builder
    {
        return $query->where('audience', self::AUDIENCE_ALL);
    }

    /**
     * Simpan sasaran: audience + daftar customer (dikosongkan bila audience = all).
     *
     * @param  int[]  $customerIds
     * @return int[] id customer yang baru ditambahkan (untuk notifikasi)
     */
    public function syncAudience(string $audience, array $customerIds): array
    {
        $changes = $this->customers()->sync($audience === self::AUDIENCE_CUSTOMERS ? array_values(array_unique(array_map('intval', $customerIds))) : []);

        return array_map('intval', $changes['attached'] ?? []);
    }

    /** Ringkasan customer sasaran untuk resource admin (butuh with('customers.profile')). */
    public function audienceCustomers(): array
    {
        return $this->customers->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'company' => $user->profile?->company,
            'email' => $user->email,
        ])->values()->all();
    }
}
