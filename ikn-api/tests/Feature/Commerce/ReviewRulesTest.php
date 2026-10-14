<?php

namespace Tests\Feature\Commerce;

use App\Models\Order;
use App\Models\Review;
use App\Services\Commerce\OrderStateMachine;
use App\Support\Profanity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Isi ulasan: maksimal 255 karakter dan tanpa kata kasar (config/profanity.php, App\Rules\CleanText).
class ReviewRulesTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_review_body_is_limited_to_255_characters_and_rejects_profanity(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'produk-a'], 10);
        $order = $this->payOrder($this->placeOrder($product, 1));
        $sm = app(OrderStateMachine::class);
        $admin = $this->superAdmin();
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X1']);
        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);
        $sm->transition($order, Order::STATUS_COMPLETED, $this->buyer);
        $url = '/api/v1/customer/orders/'.$order->number.'/reviews';

        $this->actingAs($this->buyer)->postJson($url, [['productSlug' => 'produk-a', 'rating' => 4, 'body' => str_repeat('a', 256)]])
            ->assertStatus(422)->assertJsonValidationErrors(['reviews.0.body']);

        $response = $this->actingAs($this->buyer)->postJson($url, [['productSlug' => 'produk-a', 'rating' => 1, 'body' => 'Produk ini anj1ng, pelayanannya g0bl0k!']])
            ->assertStatus(422)->assertJsonValidationErrors(['reviews.0.body']);
        $this->assertMatchesRegularExpression('/tidak pantas|inappropriate/', $response->json('errors')['reviews.0.body'][0]); // kunci galat literal; bahasa ikut locale user
        $this->assertSame(0, Review::count());

        $this->actingAs($this->buyer)->postJson($url, [['productSlug' => 'produk-a', 'rating' => 5, 'body' => str_repeat('b', 255)]])
            ->assertStatus(201);
        $this->assertSame(1, Review::count());
    }

    public function test_profanity_helper_catches_variants_but_not_ordinary_words(): void
    {
        $this->assertTrue(Profanity::contains('B4NGS4T banget'));
        $this->assertTrue(Profanity::contains('anjiiiing'));
        $this->assertTrue(Profanity::contains('what the fuck'));
        $this->assertSame(['tolol'], Profanity::matches('penjualnya t0lol'));

        $this->assertFalse(Profanity::contains('Kualitas bagus, as pompa pas, pengiriman 2 hari'));
        $this->assertFalse(Profanity::contains('Dipakai di anjungan lepas pantai, tahan air'));
        $this->assertFalse(Profanity::contains(''));
        $this->assertFalse(Profanity::contains(null));
    }
}
