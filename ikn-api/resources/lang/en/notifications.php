<?php

// In-app notification texts (customer portal bell) and messages for the notification/chat area.
return [
    'order' => [
        'placed' => [
            'title' => 'Order placed',
            'body' => 'Order :number is awaiting payment. Please pay before the deadline.',
        ],
        'payment_accepted' => [
            'title' => 'Payment received',
            'body' => 'Payment for order :number has been verified. We will process it shortly.',
        ],
        'payment_rejected' => [
            'title' => 'Payment proof rejected',
            'body' => 'Payment proof for order :number was rejected: :reason. Please upload it again.',
        ],
        'payment_reminder' => [
            'title' => 'Complete your payment',
            'body' => 'The payment deadline for order :number is almost up.',
        ],
        'expired' => [
            'title' => 'Order expired',
            'body' => 'Order :number was cancelled automatically because the payment deadline passed.',
        ],
        'cancelled' => [
            'title' => 'Order cancelled',
            'body' => 'Order :number has been cancelled.',
        ],
        'shipped' => [
            'title' => 'Order shipped',
            'body' => 'Order :number was shipped via :courier, tracking number :tracking.',
        ],
        'attachment' => [
            'title' => 'New order document',
            'body' => 'An admin attached ":label" to order :number.',
        ],
        'tracking' => [
            'title' => 'Shipping update',
            'body' => 'Order :number: :note',
        ],
        'delivered' => [
            'title' => 'Order delivered',
            'body' => 'Order :number has arrived. Confirm completion if everything is in order.',
        ],
        'completed' => [
            'title' => 'Order completed',
            'body' => 'Order :number is complete. Share your experience with a review.',
        ],
    ],
    'account' => [
        'approved' => [
            'title' => 'Account approved',
            'body' => 'Your account is active. You can now place orders.',
        ],
        'rejected' => [
            'title' => 'Registration rejected',
            'body' => 'Your account registration was rejected: :reason',
        ],
    ],
    'voucher' => [
        'assigned' => [
            'title' => 'A new voucher for you',
            'body' => 'Use code :code at checkout.',
        ],
    ],

    'tracking_not_allowed' => 'Shipping notes can only be changed while the order is shipped.',
    'chat_context_invalid' => 'The referenced product or order was not found.',
    'chat_customer_invalid' => 'Customer not found.',

    'attributes' => [
        'note' => 'note',
        'body' => 'message',
        'customerId' => 'customer',
    ],
];
