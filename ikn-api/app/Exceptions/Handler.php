<?php

namespace App\Exceptions;

use App\Http\Controllers\Api\V1\Auth\RegistrationController;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        ApiException::class,
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
        'passwordConfirmation',
    ];

    public function register()
    {
        //
    }

    public function render($request, Throwable $e)
    {
        // Tautan verifikasi email kedaluwarsa/rusak (middleware signed): kembalikan ke halaman login FE, bukan JSON.
        if ($e instanceof InvalidSignatureException && $request->routeIs('auth.verify-email')) {
            return redirect()->away(RegistrationController::loginRedirect(false));
        }

        if ($request->is('api/*') || $request->expectsJson()) {
            return $this->renderApi($request, $e);
        }

        return parent::render($request, $e);
    }

    // Semua error API memakai envelope { message, code, errors?, meta? }.
    protected function renderApi(Request $request, Throwable $e): JsonResponse
    {
        if ($e instanceof ValidationException) {
            return $this->envelope(422, 'VALIDATION_ERROR', __('api.validation_error'), ['errors' => $e->errors()]);
        }

        if ($e instanceof ApiException) {
            $extra = $e->meta ? ['meta' => $e->meta] : [];

            return $this->envelope($e->status, $e->errorCode, $e->getMessage(), $extra);
        }

        if ($e instanceof AuthenticationException) {
            return $this->envelope(401, 'UNAUTHENTICATED', __('api.unauthenticated'));
        }

        if ($e instanceof AuthorizationException) {
            return $this->envelope(403, 'FORBIDDEN', __('api.forbidden'));
        }

        if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
            return $this->envelope(404, 'NOT_FOUND', __('api.not_found'));
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            return $this->envelope(405, 'METHOD_NOT_ALLOWED', __('api.method_not_allowed'));
        }

        if ($e instanceof TokenMismatchException) {
            return $this->envelope(419, 'CSRF_TOKEN_MISMATCH', __('api.csrf_mismatch'));
        }

        if ($e instanceof TooManyRequestsHttpException) {
            return $this->envelope(429, 'TOO_MANY_REQUESTS', __('api.too_many_requests'), [], $e->getHeaders());
        }

        if ($e instanceof PostTooLargeException) {
            return $this->envelope(413, 'FILE_TOO_LARGE', __('api.file_too_large'));
        }

        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            $code = $status === 503 ? 'MAINTENANCE' : 'HTTP_'.$status;

            return $this->envelope($status, $code, $e->getMessage() ?: __('api.server_error'), [], $e->getHeaders());
        }

        $message = config('app.debug') ? $e->getMessage() : __('api.server_error');
        $extra = config('app.debug')
            ? ['meta' => ['exception' => get_class($e), 'file' => $e->getFile(), 'line' => $e->getLine()]]
            : [];

        return $this->envelope(500, 'SERVER_ERROR', $message, $extra);
    }

    protected function envelope(int $status, string $code, string $message, array $extra = [], array $headers = []): JsonResponse
    {
        return response()->json(array_merge(['message' => $message, 'code' => $code], $extra), $status, $headers);
    }
}
