<?php

namespace App\Services\Payment\Gateway;

use App\Exceptions\ApiException;
use App\Models\PaymentMethod;
use Illuminate\Contracts\Container\Container;

// Resolver driver pembayaran: PaymentMethod::driver (manual|xendit) → implementasi PaymentGateway.
class GatewayManager
{
    public const DRIVERS = [
        PaymentMethod::DRIVER_MANUAL => ManualDriver::class,
        PaymentMethod::DRIVER_XENDIT => XenditDriver::class,
    ];

    public function __construct(private Container $container)
    {
    }

    public function for(PaymentMethod $method): PaymentGateway
    {
        return $this->driver((string) $method->driver);
    }

    /** @throws ApiException 404 bila provider tidak dikenal */
    public function driver(string $provider): PaymentGateway
    {
        $provider = strtolower(trim($provider));
        if (! isset(self::DRIVERS[$provider])) {
            throw ApiException::notFound();
        }

        return $this->container->make(self::DRIVERS[$provider]);
    }

    /** @return string[] */
    public static function providers(): array
    {
        return array_keys(self::DRIVERS);
    }
}
