<?php

namespace App\Providers;

use App\Models\Media;
use App\Policies\MediaPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        Media::class => MediaPolicy::class,
    ];

    public function boot()
    {
        $this->registerPolicies();
    }
}
