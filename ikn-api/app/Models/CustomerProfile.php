<?php

namespace App\Models;

// Profil customer (satu per user), PK = user_id.
class CustomerProfile extends Model
{
    protected $table = 'customer_profiles';

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = ['user_id', 'company', 'position', 'company_email', 'company_phone', 'tax_id', 'phone'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
