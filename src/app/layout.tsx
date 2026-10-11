import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Handover: get paid safely, release on delivery",
  description: "An AI money assistant for small sellers. Buyers pay with PayPal, money is held, and it only releases after both sides confirm delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
