<?php

namespace App\Models;

use App\Mail\Account\ResetPassword;
use App\Support\StoresDatesInAppTimezone;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements HasLocalePreference
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, StoresDatesInAppTimezone;

    public const ROLE_SUPER_ADMIN = 'super_admin';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_CUSTOMER = 'customer';
    public const ROLES = [self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN, self::ROLE_CUSTOMER];
    public const ADMIN_ROLES = [self::ROLE_SUPER_ADMIN, self::ROLE_ADMIN];

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUSES = [self::STATUS_PENDING, self::STATUS_ACTIVE, self::STATUS_REJECTED, self::STATUS_INACTIVE];

    public const LOCALES = ['id', 'en'];

    protected $fillable = [
        'name', 'email', 'password', 'role', 'status', 'locale', 'permissions',
        'email_verified_at', 'approved_at', 'approved_by', 'rejection_reason', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected $casts = [
        'permissions' => 'array',
        'email_verified_at' => 'datetime',
        'approved_at' => 'datetime',
        'last_login_at' => 'datetime',
    ];

    // Email selalu lowercase + trim (KEPUTUSAN).
    public function setEmailAttribute(?string $value): void
    {
        $this->attributes['email'] = $value === null ? null : strtolower(trim($value));
    }

    // Bahasa email/notifikasi mengikuti users.locale (default id). Dipakai Mail::to($user) secara otomatis.
    public function preferredLocale(): string
    {
        $locale = $this->locale ?: config('app.locale', 'id');

        return in_array($locale, self::LOCALES, true) ? $locale : 'id';
    }

    // Password broker memanggil ini; kirim Mailable dua bahasa sendiri (bukan notifikasi bawaan).
    public function sendPasswordResetNotification($token): void
    {
        Mail::to($this)->send(new ResetPassword($this, $token));
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, self::ADMIN_ROLES, true);
    }

    public function isCustomer(): bool
    {
        return $this->role === self::ROLE_CUSTOMER;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    public function hasVerifiedEmail(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function scopeAdmins($query)
    {
        return $query->whereIn('role', self::ADMIN_ROLES);
    }

    public function scopeCustomers(Builder $query): Builder
    {
        return $query->where('role', self::ROLE_CUSTOMER);
    }

    public function profile()
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function addresses()
    {
        return $this->hasMany(CustomerAddress::class)->orderByDesc('is_default')->orderBy('id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(self::class, 'approved_by');
    }

    // Order milik customer (area BE-3); dipakai AdminCustomerResource dan dashboard customer.
    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
