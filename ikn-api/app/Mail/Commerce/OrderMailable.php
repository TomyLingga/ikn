<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;

/**
 * Dasar email transaksional order (pola App\Mail\Account\AccountMailable): antrean, bahasa mengikuti
 * snapshot orders.locale (customer) atau 'id' (admin), tautan FE dari config ikn.frontend_url.
 */
abstract class OrderMailable extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public Order $order;

    public function __construct(Order $order, ?string $locale = null)
    {
        $this->order = $order;
        $this->locale = $locale ?? $order->preferredLocale();
    }

    /** URL halaman order di dashboard customer: FRONTEND_URL/dashboard/pesanan/{number}. */
    public function orderUrl(): string
    {
        return $this->frontendUrl('/dashboard/pesanan/'.$this->order->number);
    }

    /** URL halaman order di panel admin: FRONTEND_URL/admin/orders/{number}. */
    public function adminOrderUrl(): string
    {
        return $this->frontendUrl('/admin/orders/'.$this->order->number);
    }

    protected function frontendUrl(string $path = ''): string
    {
        return rtrim((string) config('ikn.frontend_url'), '/').'/'.ltrim($path, '/');
    }

    protected function trans(string $key, array $replace = []): string
    {
        return __($key, $replace, $this->locale);
    }

    /** Data dasar untuk semua view email order. */
    protected function baseData(array $extra = []): array
    {
        $this->order->loadMissing(['items', 'payments']);

        return array_merge([
            'order' => $this->order,
            'url' => $this->orderUrl(),
            'adminUrl' => $this->adminOrderUrl(),
            'locale' => $this->locale,
        ], $extra);
    }

    /** "Rp 1.234.567" */
    public static function money(int $amount): string
    {
        return 'Rp '.number_format($amount, 0, ',', '.');
    }

    /** "28 Sep 2026 09:24 WIB" (zona aplikasi). */
    public static function dateTime(?Carbon $date): string
    {
        if (! $date) {
            return '-';
        }

        return $date->copy()->setTimezone(config('app.timezone'))->format('d M Y H:i').' WIB';
    }
}
