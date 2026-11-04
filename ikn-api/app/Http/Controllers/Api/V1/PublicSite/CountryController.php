<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Support\Countries;

// GET /countries (publik): daftar negara ISO 3166-1 alpha-2 + nama {id,en} untuk form daftar/profil (ASUMSI A-86).
class CountryController extends ApiController
{
    public function index()
    {
        return $this->data(Countries::toApi());
    }
}
