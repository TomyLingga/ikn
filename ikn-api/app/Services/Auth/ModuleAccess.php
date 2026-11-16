<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Collection;

// Satu pintu pemeriksaan modul admin (ASUMSI A-4: role + permissions jsonb, tanpa package).
class ModuleAccess
{
    /** @return array<string, array{id:string,en:string}> */
    public function modules(): array
    {
        return config('ikn.modules', []);
    }

    /** @return string[] */
    public function moduleCodes(): array
    {
        return array_keys($this->modules());
    }

    public function isKnown(string $module): bool
    {
        return array_key_exists($module, $this->modules());
    }

    public function allows(User $user, string $module): bool
    {
        if (! $user->isAdmin() || ! $user->isActive()) {
            return false;
        }

        if ($user->isSuperAdmin()) {
            return true;
        }

        return in_array($module, $user->permissions ?? [], true);
    }

    /**
     * Admin aktif yang boleh mengakses modul (super_admin selalu termasuk): penerima email dan notifikasi admin.
     *
     * @return Collection<int, User>
     */
    public function adminsWith(string $module): Collection
    {
        return User::admins()->where('status', User::STATUS_ACTIVE)->orderBy('id')->get()
            ->filter(fn (User $user) => $this->allows($user, $module))
            ->values();
    }

    /** Daftar modul yang boleh diakses user; super_admin = semua. */
    public function allowedFor(User $user): array
    {
        if (! $user->isAdmin() || ! $user->isActive()) {
            return [];
        }

        if ($user->isSuperAdmin()) {
            return $this->moduleCodes();
        }

        return array_values(array_filter($user->permissions ?? [], fn ($m) => $this->isKnown($m)));
    }
}
