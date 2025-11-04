import { NextResponse, NextRequest } from "next/server";
import Stripe from "stripe";
import { captureError } from "src/infra/error-tracking";
import { logger } from "src/infra/server-logger";
import {
  buildInvoicePaymentFailedMessage,
  buildPaymentActionRequiredMessage,
  buildDisputeCreatedMessage,
  buildFraudWarningMessage,
  buildDisputeFundsWithdrawnMessage,
  buildSubscriptionPastDueMessage,
  buildSubscriptionDeletedMessage,
  buildSubscriptionPausedMessage,
  buildCardExpiringMessage,
  buildTrialEndingMessage,
  buildRenewalSuccessMessage,
  buildPlanChangeMessage,
  buildPaymentSuccessMessage,
  buildCheckoutCompletedMessage,
  sendPaymentNotification,
} from "src/infra/slack";

/**
 * Stripe Webhook Handler - Comprehensive Payment Monitoring
 *
 * Setup Instructions:
 * 1. Go to Stripe Dashboard → Developers → Webhooks
 * 2. Add endpoint: https://yourdomain.com/api/stripe-webhook
 * 3. Select these 13 events:
 *    Critical (Immediate Action):
 *    - invoice.payment_failed
 *    - invoice.payment_action_required
 *    - charge.dispute.created
 *    - charge.dispute.funds_withdrawn
 *    - radar.early_fraud_warning.created
 *
 *    Warnings (Monitor):
 *    - customer.subscription.updated
 *    - customer.subscription.deleted
 *    - customer.subscription.paused
 *    - customer.source.expiring
 *    - customer.subscription.trial_will_end
 *
 *    Success (FYI):
 *    - invoice.payment_succeeded
 *
 *    Info:
 *    - checkout.session.completed
 *
 * 4. Copy the webhook signing secret (whsec_...) to STRIPE_WEBHOOK_SECRET env var
 *
 * Local Testing:
 * 1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
 * 2. Login: stripe login
 * 3. Forward events: stripe listen --forward-to localhost:3000/api/stripe-webhook
 * 4. Use the webhook signing secret from CLI output
 * 5. Trigger test events: stripe trigger invoice.payment_failed
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const getCustomerEmail = async (
  customerId: string | undefined | null,
): Promise<string> => {
  if (!customerId) return "Unknown";

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return "Deleted Customer";
    return customer.email || "No email on file";
  } catch (error) {
    logger.error(`Failed to fetch customer email: ${(error as Error).message}`);
    return "Unknown";
  }
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    logger.info("Stripe webhook: Missing signature header");
    return new NextResponse("Missing signature", { status: 401 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("Stripe webhook: STRIPE_WEBHOOK_SECRET not configured");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    logger.error(
      `Stripe webhook signature verification failed: ${error.message}`,
    );
    return new NextResponse(
      `Webhook signature verification failed: ${error.message}`,
      {
        status: 401,
      },
    );
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    // Critical Events
    if (event.type === "invoice.payment_failed") {
      return await handleInvoicePaymentFailed(event);
    }
    if (event.type === "invoice.payment_action_required") {
      return await handlePaymentActionRequired(event);
    }
    if (event.type === "charge.dispute.created") {
      return await handleDisputeCreated(event);
    }
    if (event.type === "charge.dispute.funds_withdrawn") {
      return await handleDisputeFundsWithdrawn(event);
    }
    if (event.type === "radar.early_fraud_warning.created") {
      return await handleFraudWarning(event);
    }

    // Warning Events
    if (event.type === "customer.subscription.updated") {
      return await handleSubscriptionUpdated(event);
    }
    if (event.type === "customer.subscription.deleted") {
      return await handleSubscriptionDeleted(event);
    }
    if (event.type === "customer.subscription.paused") {
      return await handleSubscriptionPaused(event);
    }
    if (event.type === "customer.source.expiring") {
      return await handleCardExpiring(event);
    }
    if (event.type === "customer.subscription.trial_will_end") {
      return await handleTrialEnding(event);
    }

    // Success Events
    if (event.type === "invoice.payment_succeeded") {
      return await handleInvoicePaymentSucceeded(event);
    }

    // Info Events
    if (event.type === "checkout.session.completed") {
      return await handleCheckoutCompleted(event);
    }

    // Event type not handled - still return success
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const err = error as Error;
    logger.error(`Error handling Stripe webhook: ${err.message}`);
    captureError(err);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// ============================================================================
// CRITICAL EVENT HANDLERS (Red - Immediate Action Required)
// ============================================================================

const handleInvoicePaymentFailed = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  logger.info(
    `🚨 Invoice payment failed: ${invoice.id} for customer ${customerId} (attempt ${invoice.attempt_count})`,
  );

  const message = buildInvoicePaymentFailedMessage(invoice);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handlePaymentActionRequired = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  logger.info(
    `🚨 Payment action required (3D Secure): ${invoice.id} for customer ${customerId}`,
  );

  const message = buildPaymentActionRequiredMessage(invoice);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleDisputeCreated = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  logger.info(
    `🚨 Dispute created: ${dispute.id} for charge ${chargeId} - Amount: ${dispute.amount}`,
  );

  const message = buildDisputeCreatedMessage(dispute);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleDisputeFundsWithdrawn = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const dispute = event.data.object as Stripe.Dispute;

  logger.info(
    `🚨 Dispute funds withdrawn: ${dispute.id} - Amount: ${dispute.amount}`,
  );

  const message = buildDisputeFundsWithdrawnMessage(dispute);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleFraudWarning = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
  const chargeId =
    typeof warning.charge === "string" ? warning.charge : warning.charge?.id;

  logger.info(`🚨 Fraud warning: ${warning.id} for charge ${chargeId}`);

  const message = buildFraudWarningMessage(warning);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

// ============================================================================
// WARNING EVENT HANDLERS (Yellow - Monitor Closely)
// ============================================================================

const handleSubscriptionUpdated = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const subscription = event.data.object as Stripe.Subscription;

  if (subscription.status === "past_due" || subscription.status === "unpaid") {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;
    const customerEmail = await getCustomerEmail(customerId);

    logger.info(
      `⚠️ Subscription ${subscription.status}: ${subscription.id} for customer ${customerId}`,
    );

    const message = buildSubscriptionPastDueMessage(
      subscription,
      customerEmail,
    );
    await sendPaymentNotification(message);
  }

  return NextResponse.json({ status: "success" });
};

const handleSubscriptionDeleted = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  const customerEmail = await getCustomerEmail(customerId);

  logger.info(
    `⚠️ Subscription deleted: ${subscription.id} for customer ${customerId}`,
  );

  const message = buildSubscriptionDeletedMessage(subscription, customerEmail);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleSubscriptionPaused = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  const customerEmail = await getCustomerEmail(customerId);

  logger.info(
    `⚠️ Subscription paused: ${subscription.id} for customer ${customerId}`,
  );

  const message = buildSubscriptionPausedMessage(subscription, customerEmail);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleCardExpiring = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const card = event.data.object as Stripe.Card;
  const customerId =
    typeof card.customer === "string" ? card.customer : card.customer?.id;
  const customerEmail = await getCustomerEmail(customerId);

  logger.info(
    `⚠️ Card expiring: ${card.id} for customer ${customerId} (exp: ${card.exp_month}/${card.exp_year})`,
  );

  const message = buildCardExpiringMessage(card, customerEmail);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

const handleTrialEnding = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  const customerEmail = await getCustomerEmail(customerId);

  logger.info(
    `⚠️ Trial ending soon: ${subscription.id} for customer ${customerId}`,
  );

  const message = buildTrialEndingMessage(subscription, customerEmail);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};

// ============================================================================
// SUCCESS EVENT HANDLERS (Green - FYI)
// ============================================================================

const handleInvoicePaymentSucceeded = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (invoice.billing_reason === "subscription_cycle") {
    logger.info(
      `✅ Renewal successful: ${invoice.id} for customer ${customerId}`,
    );

    const message = buildRenewalSuccessMessage(invoice);
    await sendPaymentNotification(message);
  } else if (invoice.billing_reason === "subscription_update") {
    logger.info(
      `✅ Plan change successful: ${invoice.id} for customer ${customerId}`,
    );

    const message = buildPlanChangeMessage(invoice);
    await sendPaymentNotification(message);
  } else {
    logger.info(
      `✅ Payment successful: ${invoice.id} for customer ${customerId} (${invoice.billing_reason || "unknown"})`,
    );

    const message = buildPaymentSuccessMessage(invoice);
    await sendPaymentNotification(message);
  }

  return NextResponse.json({ status: "success" });
};

// ============================================================================
// INFO EVENT HANDLERS (Blue - Informational)
// ============================================================================

const handleCheckoutCompleted = async (
  event: Stripe.Event,
): Promise<NextResponse> => {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  logger.info(
    `ℹ️ Checkout completed: ${session.id} - customer ${customerId} (mode: ${session.mode})`,
  );

  const message = buildCheckoutCompletedMessage(session);
  await sendPaymentNotification(message);

  return NextResponse.json({ status: "success" });
};
