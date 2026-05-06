/**
 * Stripe Subscription Products & Pricing
 * Define all subscription tiers for Vearch Bank implant services
 */

export const SUBSCRIPTION_PRODUCTS = {
  BASIC: {
    name: "Basic Implant",
    description: "Essential implant features",
    monthlyPrice: 29,
    features: [
      "Basic implant monitoring",
      "Weekly health reports",
      "Email support",
      "Up to 5 transactions/month",
    ],
    stripeProductId: "prod_basic_implant", // Will be created in Stripe
  },
  PRO: {
    name: "Pro Implant",
    description: "Advanced implant with premium features",
    monthlyPrice: 79,
    features: [
      "Advanced implant monitoring",
      "Daily health reports",
      "Priority email & chat support",
      "Unlimited transactions",
      "Custom health alerts",
      "API access",
    ],
    stripeProductId: "prod_pro_implant",
  },
  ENTERPRISE: {
    name: "Enterprise Implant",
    description: "Full-featured implant with dedicated support",
    monthlyPrice: 199,
    features: [
      "Enterprise implant monitoring",
      "Real-time health analytics",
      "24/7 phone & chat support",
      "Unlimited transactions",
      "Advanced health alerts",
      "Full API access",
      "Dedicated account manager",
      "Custom integrations",
    ],
    stripeProductId: "prod_enterprise_implant",
  },
};

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PRODUCTS;

export function getSubscriptionTier(tier: string): (typeof SUBSCRIPTION_PRODUCTS)[SubscriptionTier] | null {
  const tierKey = tier.toUpperCase() as SubscriptionTier;
  return SUBSCRIPTION_PRODUCTS[tierKey] || null;
}

export function getAllTiers() {
  return Object.entries(SUBSCRIPTION_PRODUCTS).map(([key, value]) => ({
    tier: key,
    ...value,
  }));
}
