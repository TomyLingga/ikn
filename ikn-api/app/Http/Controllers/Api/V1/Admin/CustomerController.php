<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\UpdateCustomerStatusRequest;
use App\Http\Resources\AdminCustomerListResource;
use App\Http\Resources\AdminCustomerResource;
use App\Models\User;
use App\Services\Account\CustomerStatusService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

// Admin customers (kontrak 11.4), modul `customers`. Aksi tulis dicatat middleware audit.
class CustomerController extends ApiController
{
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['nullable', 'string', Rule::in(User::STATUSES)],
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $query = User::customers()->with('profile')->withCount('addresses');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($q = trim((string) $request->query('q'))) {
            $like = '%'.addcslashes($q, '%_\\').'%';
            $query->where(function ($w) use ($like) {
                $w->where('name', 'ILIKE', $like)
                    ->orWhere('email', 'ILIKE', $like)
                    ->orWhereHas('profile', fn ($p) => $p->where('company', 'ILIKE', $like)->orWhere('phone', 'ILIKE', $like));
            });
        }

        return $this->paginated($query->orderByDesc('created_at')->paginate($this->perPage()), AdminCustomerListResource::class, ['counts' => $this->statusCounts(User::customers(), User::STATUSES)]);
    }

    public function show(User $customer)
    {
        return $this->data(new AdminCustomerResource($this->assertCustomer($customer)));
    }

    public function updateStatus(UpdateCustomerStatusRequest $request, User $customer, CustomerStatusService $service)
    {
        $customer = $service->transition(
            $this->assertCustomer($customer),
            $request->input('status'),
            $request->input('reason'),
            $request->user()
        );

        return $this->data(new AdminCustomerResource($customer->fresh()), 200, ['message' => __('account.status_updated')]);
    }

    private function assertCustomer(User $user): User
    {
        if (! $user->isCustomer()) {
            throw ApiException::notFound();
        }

        return $user;
    }
}
