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
        'ready_for_pickup' => [
            'title' => 'Order ready for pickup',
            'body' => 'Order :number is ready for pickup at :label.',
        ],
        'shipped_on_board' => [
            'title' => 'Order shipped on board',
            'body' => 'Order :number was loaded on board :vessel, B/L :bl.',
        ],
        'proforma_updated' => [
            'title' => 'Proforma invoice updated',
            'body' => 'Proforma invoice :label for order :number is available on the order page.',
        ],
        'picked_up' => [
            'title' => 'Order picked up',
            'body' => 'Order :number is recorded as picked up. Confirm completion if everything is in order.',
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
        // CIF freight quotes (ASUMSI A-89).
        'freight_requested' => [
            'title' => 'Order received, awaiting freight',
            'body' => 'Order :number to :port is awaiting a freight quote from our team.',
        ],
        'freight_quoted' => [
            'title' => 'Freight quote available',
            'body' => 'A freight quote of :total for order :number is valid until :until. Accept it or submit a counter offer.',
        ],
        'freight_quote_extended' => [
            'title' => 'Quote validity extended',
            'body' => 'The freight quote of :total for order :number is now valid until :until.',
        ],
        'freight_accepted' => [
            'title' => 'Freight agreed',
            'body' => 'Freight of :total for order :number has been agreed. Please complete the payment before the deadline.',
        ],
        'freight_expired' => [
            'title' => 'Freight quote expired',
            'body' => 'Freight quote round :round for order :number passed its validity. Our team will renew it.',
        ],
        'freight_cancelled' => [
            'title' => 'Order cancelled',
            'body' => 'Order :number was cancelled automatically because the waiting period for a freight quote passed.',
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
