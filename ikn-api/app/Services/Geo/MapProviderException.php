<?php

namespace App\Services\Geo;

use RuntimeException;

/** Penyedia tile peta menolak atau tidak bisa dihubungi; pesannya aman ditampilkan ke admin (tanpa API key). */
class MapProviderException extends RuntimeException
{
}
