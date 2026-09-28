<?php

namespace App\Models;

use App\Support\StoresDatesInAppTimezone;
use Illuminate\Database\Eloquent\Model as Eloquent;

// Base model semua entitas: tanggal selalu disimpan dalam zona aplikasi (lihat ASUMSI A-33).
abstract class Model extends Eloquent
{
    use StoresDatesInAppTimezone;
}
