import { Plan } from "src/user-plan";
import { captureError } from "./error-tracking";
import { logger } from "./server-logger";
import Stripe from "stripe";

export const sendWithoutCrashing = async (message: string) => {
  const webhookUrl = process.env.SLACK_USERS_WEBHOOK;
  if (!webhookUrl) {
    logger.info("No webhook configured, skipping notification...");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: message,
    });

    if (!response.ok) {
      captureError(
        new Error(`Error sending message to Slack: ${response.statusText}`),
      );
    }
  } catch (error) {
    captureError(
      new Error(`Error sending message to Slack: ${(error as Error).message}`),
    );
  }
};

export const buildUserCreatedMessage = (
  email: string,
  firstName: string,
  lastName: string,
  plan: Plan,
) => {
  const emoji = plan === "education" ? ":nerd_face:" : ":smiley:";
  return JSON.stringify({
    text: `${emoji} New User Created!`,
    attachments: [
      {
        title: "User Details",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
          },
          {
            title: "Plan",
            value: plan,
            short: true,
          },
          {
            title: "First Name",
            value: firstName,
            short: true,
          },
          {
            title: "Last Name",
            value: lastName,
            short: true,
          },
        ],
      },
    ],
  });
};

export const buildTrialActivatedMessage = (
  email: string,
  firstName: string,
  lastName: string,
  trialEndsAt: string,
) => {
  return JSON.stringify({
    text: ":rocket: New Trial Activated!",
    attachments: [
      {
        title: "Trial Details",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
          },
          {
            title: "Trial Ends At",
            value: trialEndsAt,
            short: true,
          },
          {
            title: "First Name",
            value: firstName,
            short: true,
          },
          {
            title: "Last Name",
            value: lastName,
            short: true,
          },
        ],
      },
    ],
  });
};

export const buildUserUpgradedMessage = (
  email: string,
  plan: string,
  paymentType: string,
) => {
  const message = {
    text: ":money_with_wings: New upgrade!",
    attachments: [
      {
        title: "User Details",
        color: "good",
        fields: [
          {
            title: "Email",
            value: email,
            short: true,
          },
          {
            title: "Plan",
            value: plan,
            short: true,
          },
          {
            title: "Payment type",
            value: paymentType,
            short: true,
          },
        ],
      },
    ],
  };
  return JSON.stringify(message);
};

export const buildUserDeletedMessage = (userId: string) => {
  return JSON.stringify({
    text: ":cry: User Deleted!",
    attachments: [
      {
        title: "User Details",
        fields: [
          {
            title: "Id",
            value: userId,
            short: false,
          },
        ],
      },
    ],
  });
};

// ============================================================================
// PAYMENT NOTIFICATION FUNCTIONS
// ============================================================================

export const sendPaymentNotification = async (message: string) => {
  const webhookUrl = process.env.SLACK_PAYMENTS_WEBHOOK;
  if (!webhookUrl) {
    logger.info("No payment webhook configured, skipping notification...");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: message,
    });

    if (!response.ok) {
      captureError(
        new Error(
          `Error sending payment notification to Slack: ${response.statusText}`,
        ),
      );
    }
  } catch (error) {
    captureError(
      new Error(
        `Error sending payment notification to Slack: ${(error as Error).message}`,
      ),
    );
  }
};

// ============================================================================
// CRITICAL EVENT MESSAGE BUILDERS (Red - Immediate Action)
// ============================================================================

export const buildInvoicePaymentFailedMessage = (invoice: Stripe.Invoice) => {
  const amount = invoice.amount_due
    ? `$${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`
    : "Unknown";

  const customerEmail =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email
      : "Unknown";

  const failureReason =
    invoice.last_finalization_error?.message ||
    "Card declined or insufficient funds";

  const attemptCount = invoice.attempt_count || 1;
  const attemptText = attemptCount > 1 ? ` (Attempt ${attemptCount})` : "";

  const stripeLink = `https://dashboard.stripe.com/invoices/${invoice.id}`;

  return JSON.stringify({
    text: `🚨 Invoice Payment Failed${attemptText}`,
    attachments: [
      {
        title: "CRITICAL - Payment Failure Requires Action",
        color: "danger",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Failure Reason",
            value: failureReason,
            short: false,
          },
          {
            title: "Action Required",
            value:
              "Customer needs to update payment method. Send recovery email.",
            short: false,
          },
          {
            title: "Invoice",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildPaymentActionRequiredMessage = (invoice: Stripe.Invoice) => {
  const amount = invoice.amount_due
    ? `$${(invoice.amount_due / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`
    : "Unknown";

  const customerEmail =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email
      : "Unknown";

  const hostedInvoiceUrl = invoice.hosted_invoice_url || "Not available";
  const stripeLink = `https://dashboard.stripe.com/invoices/${invoice.id}`;

  return JSON.stringify({
    text: "🚨 Payment Action Required - 3D Secure",
    attachments: [
      {
        title: "CRITICAL - Customer Must Complete Authentication",
        color: "danger",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Issue",
            value:
              "Payment blocked pending 3D Secure authentication (SCA requirement)",
            short: false,
          },
          {
            title: "Action Required",
            value: `Send email with hosted invoice URL for authentication: ${hostedInvoiceUrl}`,
            short: false,
          },
          {
            title: "Invoice",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildDisputeCreatedMessage = (dispute: Stripe.Dispute) => {
  const amount = `$${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}`;
  const reason = dispute.reason || "Unknown";
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  const stripeLink = `https://dashboard.stripe.com/disputes/${dispute.id}`;

  const evidenceDeadline = dispute.evidence_details?.due_by
    ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
    : "Unknown";

  return JSON.stringify({
    text: "🚨 DISPUTE CREATED - Chargeback Alert",
    attachments: [
      {
        title: "CRITICAL - Respond or Lose Funds + $15 Fee",
        color: "danger",
        fields: [
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Reason",
            value: reason,
            short: true,
          },
          {
            title: "Charge ID",
            value: chargeId,
            short: true,
          },
          {
            title: "Response Deadline",
            value: evidenceDeadline,
            short: true,
          },
          {
            title: "Action Required",
            value:
              "Gather evidence (receipts, communications, proof of service) and respond ASAP",
            short: false,
          },
          {
            title: "Dispute",
            value: `<${stripeLink}|View & Respond in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildDisputeFundsWithdrawnMessage = (dispute: Stripe.Dispute) => {
  const amount = `$${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}`;
  const stripeLink = `https://dashboard.stripe.com/disputes/${dispute.id}`;

  return JSON.stringify({
    text: "🚨 Dispute Funds Withdrawn",
    attachments: [
      {
        title: "CRITICAL - Cash Flow Impact",
        color: "danger",
        fields: [
          {
            title: "Amount Withdrawn",
            value: amount,
            short: true,
          },
          {
            title: "Dispute ID",
            value: dispute.id,
            short: true,
          },
          {
            title: "Status",
            value:
              "Funds debited from account pending dispute resolution (+$15 fee)",
            short: false,
          },
          {
            title: "Dispute",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildFraudWarningMessage = (
  warning: Stripe.Radar.EarlyFraudWarning,
) => {
  const chargeId =
    typeof warning.charge === "string" ? warning.charge : warning.charge.id;
  const stripeLink = `https://dashboard.stripe.com/radar/early_fraud_warnings/${warning.id}`;

  return JSON.stringify({
    text: "🚨 FRAUD WARNING - Card Issuer Alert",
    attachments: [
      {
        title: "CRITICAL - Early Fraud Warning (Pre-Dispute)",
        color: "danger",
        fields: [
          {
            title: "Charge ID",
            value: chargeId,
            short: true,
          },
          {
            title: "Fraud Type",
            value: warning.fraud_type || "Unknown",
            short: true,
          },
          {
            title: "Issue",
            value:
              "Card issuer flagged as potentially fraudulent BEFORE formal dispute",
            short: false,
          },
          {
            title: "Action Required",
            value:
              "Investigate immediately. Consider proactive refund to avoid $15 chargeback fee.",
            short: false,
          },
          {
            title: "Warning",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

// ============================================================================
// WARNING EVENT MESSAGE BUILDERS (Yellow - Monitor Closely)
// ============================================================================

export const buildSubscriptionPastDueMessage = (
  subscription: Stripe.Subscription,
  customerEmail: string,
) => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const stripeLink = `https://dashboard.stripe.com/subscriptions/${subscription.id}`;
  const customerLink = `https://dashboard.stripe.com/customers/${customerId}`;

  const statusText =
    subscription.status === "past_due"
      ? "Payment failed, automatic retries ongoing"
      : "All retries exhausted, no longer attempting charges";

  return JSON.stringify({
    text: `⚠️ Subscription ${subscription.status.toUpperCase()}`,
    attachments: [
      {
        title: "WARNING - Subscription Payment Issue",
        color: "warning",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Status",
            value: subscription.status,
            short: true,
          },
          {
            title: "Issue",
            value: statusText,
            short: false,
          },
          {
            title: "Action",
            value:
              subscription.status === "unpaid"
                ? "Final warning - consider reaching out with special offer"
                : "Monitor for resolution or escalation",
            short: false,
          },
          {
            title: "Customer ID",
            value: `<${customerLink}|${customerId}>`,
            short: true,
          },
          {
            title: "Subscription",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildSubscriptionDeletedMessage = (
  subscription: Stripe.Subscription,
  customerEmail: string,
) => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const stripeLink = `https://dashboard.stripe.com/subscriptions/${subscription.id}`;
  const customerLink = `https://dashboard.stripe.com/customers/${customerId}`;

  const cancellationReason =
    subscription.cancellation_details?.reason || subscription.canceled_at
      ? "Customer canceled or too many failed payments"
      : "Unknown";

  return JSON.stringify({
    text: "⚠️ Subscription Canceled",
    attachments: [
      {
        title: "WARNING - Customer Lost",
        color: "warning",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Cancellation Reason",
            value: cancellationReason,
            short: true,
          },
          {
            title: "Action",
            value:
              "Revoke access. Consider exit survey or win-back campaign if voluntary cancellation.",
            short: false,
          },
          {
            title: "Customer ID",
            value: `<${customerLink}|${customerId}>`,
            short: true,
          },
          {
            title: "Subscription",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildSubscriptionPausedMessage = (
  subscription: Stripe.Subscription,
  customerEmail: string,
) => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const stripeLink = `https://dashboard.stripe.com/subscriptions/${subscription.id}`;
  const customerLink = `https://dashboard.stripe.com/customers/${customerId}`;

  return JSON.stringify({
    text: "⚠️ Subscription Paused",
    attachments: [
      {
        title: "WARNING - Payment Method Missing",
        color: "warning",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Status",
            value: "paused",
            short: true,
          },
          {
            title: "Issue",
            value:
              "Trial ended without payment method or payment method removed",
            short: false,
          },
          {
            title: "Action",
            value:
              "Send email prompting customer to add payment method to resume",
            short: false,
          },
          {
            title: "Customer ID",
            value: `<${customerLink}|${customerId}>`,
            short: true,
          },
          {
            title: "Subscription",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildCardExpiringMessage = (
  card: Stripe.Card,
  customerEmail: string,
) => {
  const customerId =
    typeof card.customer === "string" ? card.customer : card.customer?.id;
  const expiryDate = `${card.exp_month}/${card.exp_year}`;
  const cardBrand = card.brand || "Unknown";
  const last4 = card.last4 || "****";

  const customerLink = customerId
    ? `https://dashboard.stripe.com/customers/${customerId}`
    : "Unknown";

  return JSON.stringify({
    text: "⚠️ Card Expiring Soon",
    attachments: [
      {
        title: "WARNING - Proactive Payment Method Update Needed",
        color: "warning",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Card",
            value: `${cardBrand} ****${last4}`,
            short: true,
          },
          {
            title: "Expiry Date",
            value: expiryDate,
            short: true,
          },
          {
            title: "Action",
            value:
              "Send proactive email asking customer to update card before expiration to avoid payment failures",
            short: false,
          },
          {
            title: "Customer ID",
            value: customerId ? `<${customerLink}|${customerId}>` : "Unknown",
            short: true,
          },
        ],
      },
    ],
  });
};

export const buildTrialEndingMessage = (
  subscription: Stripe.Subscription,
  customerEmail: string,
) => {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString()
    : "Unknown";

  const stripeLink = `https://dashboard.stripe.com/subscriptions/${subscription.id}`;
  const customerLink = `https://dashboard.stripe.com/customers/${customerId}`;

  return JSON.stringify({
    text: "⚠️ Trial Ending in 3 Days",
    attachments: [
      {
        title: "WARNING - Verify Payment Method Before Charge Attempt",
        color: "warning",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Trial End Date",
            value: trialEnd,
            short: true,
          },
          {
            title: "Action",
            value:
              "Verify customer has valid payment method. Send reminder email if missing.",
            short: false,
          },
          {
            title: "Customer ID",
            value: `<${customerLink}|${customerId}>`,
            short: true,
          },
          {
            title: "Subscription",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

// ============================================================================
// SUCCESS EVENT MESSAGE BUILDERS (Green - FYI)
// ============================================================================

export const buildRenewalSuccessMessage = (invoice: Stripe.Invoice) => {
  const amount = invoice.amount_paid
    ? `$${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`
    : "Unknown";

  const customerEmail =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email
      : "Unknown";

  const nextRenewal = invoice.subscription
    ? typeof invoice.subscription === "string"
      ? "View subscription for details"
      : invoice.subscription.current_period_end
        ? new Date(
            invoice.subscription.current_period_end * 1000,
          ).toLocaleDateString()
        : "Unknown"
    : "Unknown";

  const stripeLink = `https://dashboard.stripe.com/invoices/${invoice.id}`;

  return JSON.stringify({
    text: "✅ Subscription Renewed Successfully",
    attachments: [
      {
        title: "SUCCESS - Recurring Payment Received",
        color: "good",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Next Renewal",
            value: nextRenewal,
            short: true,
          },
          {
            title: "Invoice",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildPlanChangeMessage = (invoice: Stripe.Invoice) => {
  const amount = invoice.amount_paid
    ? `$${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`
    : "$0.00 (proration)";

  const customerEmail =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email
      : "Unknown";

  const stripeLink = `https://dashboard.stripe.com/invoices/${invoice.id}`;

  return JSON.stringify({
    text: "✅ Plan Change Successful",
    attachments: [
      {
        title: "SUCCESS - Subscription Updated",
        color: "good",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Change Type",
            value: "Upgrade/Downgrade/Modification",
            short: false,
          },
          {
            title: "Invoice",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

export const buildPaymentSuccessMessage = (invoice: Stripe.Invoice) => {
  const amount = invoice.amount_paid
    ? `$${(invoice.amount_paid / 100).toFixed(2)} ${invoice.currency.toUpperCase()}`
    : "Unknown";

  const customerEmail =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email
      : "Unknown";

  const billingReason = invoice.billing_reason || "subscription_create";
  const reasonText =
    billingReason === "subscription_create"
      ? "Initial Payment"
      : billingReason === "subscription_cycle"
        ? "Subscription Renewal"
        : billingReason === "subscription_update"
          ? "Plan Change"
          : billingReason;

  const stripeLink = `https://dashboard.stripe.com/invoices/${invoice.id}`;

  return JSON.stringify({
    text: "✅ Payment Successful",
    attachments: [
      {
        title: "SUCCESS - Payment Received",
        color: "good",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Amount",
            value: amount,
            short: true,
          },
          {
            title: "Type",
            value: reasonText,
            short: true,
          },
          {
            title: "Invoice",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};

// ============================================================================
// INFO EVENT MESSAGE BUILDERS (Blue - Informational)
// ============================================================================

export const buildCheckoutCompletedMessage = (
  session: Stripe.Checkout.Session,
) => {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || "Unknown";

  const customerEmail =
    session.customer_email || session.customer_details?.email || "Unknown";

  const stripeLink = `https://dashboard.stripe.com/checkout/sessions/${session.id}`;
  const customerLink =
    customerId !== "Unknown"
      ? `https://dashboard.stripe.com/customers/${customerId}`
      : null;

  return JSON.stringify({
    text: "ℹ️ Checkout Completed",
    attachments: [
      {
        title: "INFO - Checkout Session Completed",
        color: "#439FE0",
        fields: [
          {
            title: "Customer Email",
            value: customerEmail,
            short: true,
          },
          {
            title: "Customer ID",
            value: customerLink
              ? `<${customerLink}|${customerId}>`
              : customerId,
            short: true,
          },
          {
            title: "Mode",
            value: session.mode,
            short: true,
          },
          {
            title: "Session",
            value: `<${stripeLink}|View in Stripe Dashboard>`,
            short: false,
          },
        ],
      },
    ],
  });
};
