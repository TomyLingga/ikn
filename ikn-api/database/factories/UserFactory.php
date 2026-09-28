<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition()
    {
        return [
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
            'role' => User::ROLE_CUSTOMER,
            'status' => User::STATUS_ACTIVE,
            'locale' => 'id',
            'permissions' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified()
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }

    public function admin(array $permissions = [])
    {
        return $this->state(fn () => ['role' => User::ROLE_ADMIN, 'permissions' => $permissions]);
    }

    public function superAdmin()
    {
        return $this->state(fn () => ['role' => User::ROLE_SUPER_ADMIN, 'permissions' => null]);
    }

    public function inactive()
    {
        return $this->state(fn () => ['status' => User::STATUS_INACTIVE]);
    }
}
