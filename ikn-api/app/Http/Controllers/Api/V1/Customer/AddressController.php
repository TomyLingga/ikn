<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\AddressRequest;
use App\Http\Resources\CustomerAddressResource;
use App\Models\CustomerAddress;
use App\Services\Account\AddressService;
use Illuminate\Http\Request;

// Alamat customer (kontrak bagian 4). Alamat milik user lain → 404 (query selalu dibatasi user login).
class AddressController extends ApiController
{
    public function __construct(private AddressService $addresses)
    {
    }

    public function index(Request $request)
    {
        $items = $request->user()->addresses()->with(CustomerAddress::REGION_RELATIONS)->get();

        return $this->data(CustomerAddressResource::collection($items));
    }

    public function store(AddressRequest $request)
    {
        $address = $this->addresses->create($request->user(), $request->validated());

        return $this->created(new CustomerAddressResource($address), ['message' => __('account.address_saved')]);
    }

    public function update(AddressRequest $request, int $id)
    {
        $address = $this->addresses->update($this->find($request, $id), $request->validated());

        return $this->data(new CustomerAddressResource($address->fresh(CustomerAddress::REGION_RELATIONS)), 200, ['message' => __('account.address_saved')]);
    }

    public function setPrimary(Request $request, int $id)
    {
        $address = $this->addresses->setDefault($this->find($request, $id));

        return $this->data(new CustomerAddressResource($address->fresh(CustomerAddress::REGION_RELATIONS)));
    }

    public function destroy(Request $request, int $id)
    {
        $this->addresses->delete($this->find($request, $id));

        return $this->deleted();
    }

    private function find(Request $request, int $id): CustomerAddress
    {
        return $request->user()->addresses()->findOrFail($id);
    }
}
