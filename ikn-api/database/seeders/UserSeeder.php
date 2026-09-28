<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run()
    {
        $password = Hash::make(config('ikn.seed.super_admin_password'));

        User::updateOrCreate(
            ['email' => config('ikn.seed.super_admin_email')],
            [
                'name' => 'Super Admin IKN',
                'password' => $password,
                'role' => User::ROLE_SUPER_ADMIN,
                'status' => User::STATUS_ACTIVE,
                'permissions' => null,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );

        // Admin konten demo: hanya modul company profile.
        User::firstOrCreate(
            ['email' => 'konten@ptikn.com'],
            [
                'name' => 'Admin Konten',
                'password' => $password,
                'role' => User::ROLE_ADMIN,
                'status' => User::STATUS_ACTIVE,
                'permissions' => ['dashboard', 'cms', 'media', 'news', 'gallery', 'certificates', 'brochures', 'wbs', 'messages'],
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );

        // Customer demo (dipakai phase e-commerce; login customer FE masih mock).
        User::firstOrCreate(
            ['email' => 'buyer@coatingsolutions.co.id'],
            [
                'name' => 'Budi Santoso',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_ACTIVE,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );
    }
}
