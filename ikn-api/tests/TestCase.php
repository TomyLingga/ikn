<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    // Header Origin dari domain FE agar Sanctum memperlakukan request sebagai SPA stateful (sesi cookie).
    protected function fromFrontend(): static
    {
        return $this->withHeaders([
            'Origin' => 'http://localhost:3000',
            'Referer' => 'http://localhost:3000/',
        ]);
    }

    protected function superAdmin(array $attributes = []): User
    {
        return User::factory()->superAdmin()->create($attributes);
    }

    protected function adminWith(array $modules, array $attributes = []): User
    {
        return User::factory()->admin($modules)->create($attributes);
    }

    protected function customer(array $attributes = []): User
    {
        return User::factory()->create($attributes);
    }
}
