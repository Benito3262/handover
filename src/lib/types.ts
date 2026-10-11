export type OrderStatus =
  | "created" // invoice sent, waiting for buyer to pay
  | "held" // buyer paid, funds authorized and held
  | "shipped" // seller marked shipped
  | "delivered" // buyer confirmed receipt, waiting on seller confirmation
  | "disputed" // buyer raised a problem
  | "settled" // funds captured to seller
  | "partially_settled" // partial capture after a dispute
  | "refunded" // authorization voided, buyer keeps their money
  | "cancelled"; // seller cancelled before payment

export interface Item {
  name: string;
  qty: number;
  unit_price: number;
}

export interface Seller {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  passcode_hash: string;
  paypal_email: string | null;
  auto_release_hours: number;
  is_demo: boolean;
  created_at: string;
}

export interface RiskFlag {
  level: "low" | "medium" | "high";
  code: string;
  message: string;
}

export interface Resolution {
  outcome: "release" | "partial" | "refund";
  capture_amount: number; // what the seller receives
  reasoning: string;
  source: "ai" | "rules";
  proposed_at: string;
  seller_accepted: boolean;
  buyer_accepted: boolean;
}

export interface Dispute {
  reason: string;
  raised_at: string;
  resolution?: Resolution | null;
  history?: Resolution[];
}

export interface Order {
  id: string;
  seller_id: string;
  number: number;
  public_token: string;
  buyer_name: string;
  buyer_email: string | null;
  items: Item[];
  amount: number;
  currency: string;
  delivery_date: string | null;
  note: string | null;
  status: OrderStatus;
  paypal_order_id: string | null;
  authorization_id: string | null;
  authorized_at: string | null;
  auth_expires_at: string | null;
  honor_expires_at: string | null;
  simulated: boolean;
  shipped_at: string | null;
  carrier: string | null;
  tracking: string | null;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  settled_at: string | null;
  captured_amount: number | null;
  capture_id: string | null;
  refunded_amount: number | null;
  dispute: Dispute | null;
  risk: RiskFlag[] | null;
  reminders_sent: number;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderEvent {
  id: number;
  order_id: string | null;
  seller_id: string | null;
  type: string;
  actor: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  order_id: string;
  author: "seller" | "buyer" | "ai" | "system";
  body: string;
  created_at: string;
}

export interface Evidence {
  id: number;
  order_id: string;
  author: "seller" | "buyer";
  kind: "photo" | "tracking" | "note";
  caption: string | null;
  image_data: string | null;
  created_at: string;
}

export interface InvoiceDraft {
  buyer_name: string;
  buyer_email: string | null;
  items: Item[];
  amount: number;
  currency: string;
  delivery_date: string | null;
  note: string | null;
}
