<?php

namespace App\Exceptions;

use Exception;

// Error domain dengan kode stabil (lihat plan/02-api-contract.md bagian 2).
class ApiException extends Exception
{
    public function __construct(
        public int $status,
        public string $errorCode,
        string $message = '',
        public array $meta = [],
    ) {
        parent::__construct($message !== '' ? $message : $errorCode);
    }

    public static function forbidden(?string $message = null): self
    {
        return new self(403, 'FORBIDDEN', $message ?? __('api.forbidden'));
    }

    public static function notFound(?string $message = null): self
    {
        return new self(404, 'NOT_FOUND', $message ?? __('api.not_found'));
    }

    public static function conflict(string $code, string $message, array $meta = []): self
    {
        return new self(409, $code, $message, $meta);
    }

    public static function unsupportedMedia(?string $message = null): self
    {
        return new self(415, 'UNSUPPORTED_MEDIA_TYPE', $message ?? __('api.unsupported_media'));
    }

    public static function tooLarge(?string $message = null): self
    {
        return new self(413, 'FILE_TOO_LARGE', $message ?? __('api.file_too_large'));
    }
}
