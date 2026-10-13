/** Guest Payments ledger seed — never bandiShop. */

export type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expires: string;
  isDefault: boolean;
};

export type PaymentTxn = {
  id: string;
  title: string;
  category:
    | "experience"
    | "concierge"
    | "bottle"
    | "smarttraveler"
    | "hotel"
    | "membership"
    | "other";
  amountLabel: string;
  dateLabel: string;
  status: "paid" | "pending" | "refunded";
  receiptId: string;
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "pm_visa", brand: "Visa", last4: "4242", expires: "08/28", isDefault: true },
  { id: "pm_mc", brand: "Mastercard", last4: "1881", expires: "02/27", isDefault: false },
];

export const PAYMENT_HISTORY: PaymentTxn[] = [
  {
    id: "tx_oct",
    title: "Octopus Concierge · this stay",
    category: "membership",
    amountLabel: "€29.00",
    dateLabel: "Aug 5, 2026",
    status: "paid",
    receiptId: "INV-402-01",
  },
  {
    id: "tx_exp",
    title: "Chef’s courtyard tasting",
    category: "experience",
    amountLabel: "€42.00",
    dateLabel: "Aug 6, 2026",
    status: "paid",
    receiptId: "INV-402-02",
  },
  {
    id: "tx_bottle",
    title: "Travel in a Bottle · Psyrri night",
    category: "bottle",
    amountLabel: "€18.00",
    dateLabel: "Aug 4, 2026",
    status: "paid",
    receiptId: "INV-402-03",
  },
  {
    id: "tx_st",
    title: "SmartTraveler · rooftop perk claim",
    category: "smarttraveler",
    amountLabel: "€0.00",
    dateLabel: "Aug 6, 2026",
    status: "paid",
    receiptId: "INV-402-04",
  },
  {
    id: "tx_late",
    title: "Late checkout · Room 402",
    category: "hotel",
    amountLabel: "€35.00",
    dateLabel: "Pending",
    status: "pending",
    receiptId: "INV-402-05",
  },
  {
    id: "tx_conc",
    title: "Concierge · Acropolis tickets",
    category: "concierge",
    amountLabel: "€40.00",
    dateLabel: "Aug 5, 2026",
    status: "paid",
    receiptId: "INV-402-06",
  },
];

export const CATEGORY_LABEL: Record<PaymentTxn["category"], string> = {
  experience: "Experience booking",
  concierge: "Concierge purchase",
  bottle: "Bottle journey",
  smarttraveler: "SmartTraveler",
  hotel: "Hotel service",
  membership: "Membership",
  other: "Other",
};
