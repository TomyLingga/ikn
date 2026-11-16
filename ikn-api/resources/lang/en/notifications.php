<?php

// In-app notification texts (customer portal bell and admin panel bell) and messages for the notification/chat area.
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
        'processing' => [
            'title' => 'Order in process',
            'body' => 'We are preparing order :number.',
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
            'body' => 'We attached ":label" to order :number.',
        ],
        'tracking' => [
            'title' => 'Shipping update',
            'body' => 'Order :number: :note',
        ],
        'delivered' => [
            'title' => 'Order delivered',
            'body' => 'Order :number has arrived. Confirm completion if everything is in order.',
        ],
        // Staged payments (ASUMSI A-97): the order cannot be completed while an installment is unpaid.
        'delivered_balance_due' => [
            'title' => 'Order delivered',
            'body' => 'Order :number has arrived. The order is completed once the remaining :outstanding is paid.',
        ],
        'picked_up_balance_due' => [
            'title' => 'Order picked up',
            'body' => 'Order :number is recorded as picked up. The order is completed once the remaining :outstanding is paid.',
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
        // Staged payments (ASUMSI A-97).
        'installment_due' => [
            'title' => 'Installment due',
            'body' => 'The :label of :amount for order :number can now be paid. Due on :due.',
        ],
        'installment_due_changed' => [
            'title' => 'Installment due date changed',
            'body' => 'The :label for order :number is now due on :due.',
        ],
        'installment_reminder' => [
            'title' => 'Installment payment reminder',
            'body' => 'The :label of :amount for order :number is due on :due.',
        ],
        'installment_overdue' => [
            'title' => 'Installment overdue',
            'body' => 'The :label of :amount for order :number was due on :due. Please pay it as soon as possible.',
        ],
        'installment_paid' => [
            'title' => 'Installment payment received',
            'body' => 'The :label for order :number has been verified. Balance due: :outstanding.',
        ],
        'installment_rejected' => [
            'title' => 'Payment proof rejected',
            'body' => 'The payment proof for the :label of order :number was rejected: :reason. Please upload a valid proof.',
        ],
        'fully_paid' => [
            'title' => 'Order fully paid',
            'body' => 'The :label for order :number has been verified. The order is now fully paid.',
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
    // Admin panel bell: recipients = active admins with access to the module (InAppNotifier::admins).
    'admin' => [
        'order_placed' => [
            'title' => 'New order',
            'body' => ':customer placed order :number for :total.',
        ],
        'freight_requested' => [
            'title' => 'New order, freight quote needed',
            'body' => 'Order :number from :customer to :port is waiting for a freight quote.',
        ],
        'payment_proof' => [
            'title' => 'Payment proof received',
            'body' => ':customer uploaded payment proof for order :number. Check and verify it.',
        ],
        'payment_proof_installment' => [
            'title' => 'Installment payment proof received',
            'body' => ':customer uploaded payment proof for the :label of order :number. Check and verify it.',
        ],
        'freight_countered' => [
            'title' => 'Freight counter offer',
            'body' => ':customer proposed freight of :total for order :number.',
        ],
        'freight_accepted' => [
            'title' => 'Freight quote accepted',
            'body' => ':customer accepted freight of :total for order :number. The order is awaiting payment.',
        ],
        'freight_expired' => [
            'title' => 'Freight quote expired',
            'body' => 'Freight quote round :round for order :number got no answer from :customer. Extend it or send a new quote.',
        ],
        'order_cancelled' => [
            'title' => 'Order cancelled by customer',
            'body' => ':customer cancelled order :number.',
        ],
        'order_received' => [
            'title' => 'Order received by customer',
            'body' => ':customer confirmed order :number has been received.',
        ],
        'order_completed' => [
            'title' => 'Order completed by customer',
            'body' => ':customer completed order :number.',
        ],
        'customer_registered' => [
            'title' => 'New customer registration',
            'body' => ':who registered and is waiting for approval.',
        ],
    ],

    'tracking_not_allowed' => 'Shipping notes can only be changed while the order is shipped.',
    'chat_context_invalid' => 'The referenced product or order was not found.',
    'chat_customer_invalid' => 'Customer not found.',
    'chat_edit_window_passed' => 'A message can only be edited or retracted within :seconds seconds of sending. That time has passed.',
    'chat_message_retracted' => 'This message has already been retracted.',
    'chat_message_not_yours' => 'You can only edit or retract messages you sent yourself.',

    'attributes' => [
        'note' => 'note',
        'body' => 'message',
        'customerId' => 'customer',
    ],
];
