<?php

namespace App\Http\Controllers\Api;

use App\Models\Customer;
use App\Models\Device;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Stripe\Checkout\Session as StripeSession;
use Stripe\Stripe;
use Stripe\Webhook;

class PaymentController extends Controller
{
    /**
     * Plan configuration
     */
    protected array $plans = [
        'yearly' => [
            'name' => 'Skue Player - Licença Anual (1 Ano)',
            'amount_cents' => 1990, // R$ 19,90
            'currency' => 'brl',
            'duration_days' => 365,
        ],
        'lifetime' => [
            'name' => 'Skue Player - Licença Vitalícia (Perpétua)',
            'amount_cents' => 4990, // R$ 49,90
            'currency' => 'brl',
            'duration_days' => null,
        ],
    ];

    /**
     * POST /api/v1/payments/checkout-session
     * Creates a Stripe Checkout Session for a specific Device (MAC Address).
     */
    public function createCheckoutSession(Request $request): JsonResponse
    {
        $request->validate([
            'mac' => 'required|string|max:50',
            'plan' => 'required|in:yearly,lifetime',
            'customer_email' => 'nullable|email',
            'customer_name' => 'nullable|string|max:100',
        ]);

        $mac = strtoupper(trim($request->input('mac')));
        $planKey = $request->input('plan');
        $plan = $this->plans[$planKey];

        $device = Device::where('mac', $mac)->first();
        if (!$device) {
            return response()->json(['error' => 'Dispositivo não encontrado. Realize o primeiro acesso no aplicativo.'], 404);
        }

        $stripeSecret = config('services.stripe.secret');
        if (!$stripeSecret) {
            return response()->json(['error' => 'Gateway de pagamento em manutenção ou chaves não configuradas.'], 503);
        }

        Stripe::setApiKey($stripeSecret);

        $appUrl = config('app.url', 'http://localhost:8000');
        $successUrl = "{$appUrl}/portal/payment/success?session_id={CHECKOUT_SESSION_ID}&mac={$mac}";
        $cancelUrl = "{$appUrl}/portal/payment/cancel?mac={$mac}";

        try {
            $sessionParams = [
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price_data' => [
                        'currency' => $plan['currency'],
                        'product_data' => [
                            'name' => $plan['name'],
                            'description' => "Ativação direta do dispositivo MAC: {$mac}",
                        ],
                        'unit_amount' => $plan['amount_cents'],
                    ],
                    'quantity' => 1,
                ]],
                'mode' => 'payment',
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'metadata' => [
                    'device_id' => $device->id,
                    'mac' => $mac,
                    'plan' => $planKey,
                    'customer_name' => $request->input('customer_name', ''),
                    'customer_email' => $request->input('customer_email', ''),
                ],
            ];

            if ($request->filled('customer_email')) {
                $sessionParams['customer_email'] = $request->input('customer_email');
            }

            $session = StripeSession::create($sessionParams);

            return response()->json([
                'checkout_url' => $session->url,
                'session_id' => $session->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Stripe createCheckoutSession error: ' . $e->getMessage());
            return response()->json(['error' => 'Não foi possível gerar a sessão de pagamento: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/v1/webhooks/stripe
     * Handles webhook notifications directly from Stripe (100% automated activation).
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = config('services.stripe.webhook_secret');

        try {
            if ($webhookSecret && $sigHeader) {
                $event = Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
            } else {
                // Em desenvolvimento ou se webhook_secret nao definido, faz decode do json
                $event = json_decode($payload);
            }
        } catch (\Exception $e) {
            Log::warning('Stripe Webhook Signature verification failed: ' . $e->getMessage());
            return response()->json(['error' => 'Webhook signature error'], 400);
        }

        $eventType = is_object($event) && isset($event->type) ? $event->type : null;

        if ($eventType === 'checkout.session.completed') {
            $session = $event->data->object;
            $metadata = $session->metadata ?? null;

            if ($metadata && isset($metadata->mac, $metadata->plan)) {
                $mac = strtoupper(trim($metadata->mac));
                $planKey = $metadata->plan;
                $deviceId = $metadata->device_id ?? null;

                $device = $deviceId ? Device::find($deviceId) : Device::where('mac', $mac)->first();

                if ($device) {
                    $customerEmail = $session->customer_details->email ?? ($metadata->customer_email ?? null);
                    $customerName = $session->customer_details->name ?? ($metadata->customer_name ?? null);

                    // Cria ou vincula cliente se informado
                    if ($customerEmail || $customerName) {
                        $customer = null;
                        if ($customerEmail) {
                            $customer = Customer::where('email', $customerEmail)->first();
                        }
                        if (!$customer) {
                            $customer = Customer::create([
                                'name' => $customerName ?: 'Cliente ' . $device->mac,
                                'email' => $customerEmail,
                            ]);
                        }
                        $device->customer_id = $customer->id;
                    }

                    $startsAt = Carbon::now();
                    $expiresAt = $planKey === 'yearly' ? Carbon::now()->addYear() : null;
                    $amountCents = (int) ($session->amount_total ?? 0);

                    // Cria histórico da assinatura
                    Subscription::create([
                        'device_id' => $device->id,
                        'customer_id' => $device->customer_id,
                        'type' => $planKey,
                        'status' => 'active',
                        'starts_at' => $startsAt,
                        'expires_at' => $expiresAt,
                        'amount_cents' => $amountCents,
                        'payment_method' => 'stripe_card',
                        'notes' => 'Ativação automática via Stripe Checkout. ID: ' . ($session->payment_intent ?? $session->id),
                    ]);

                    // Ativa o aparelho
                    $device->status = 'active';
                    $device->save();

                    Log::info("Dispositivo {$device->mac} ATIVADO automaticamente com sucesso via Stripe ({$planKey}).");
                }
            }
        }

        return response()->json(['status' => 'received']);
    }
}
