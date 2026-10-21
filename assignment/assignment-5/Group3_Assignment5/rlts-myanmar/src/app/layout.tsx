import type { Metadata } from "next";
import StoreHydrator from "@/components/StoreHydrator";
import "./globals.css";

export const metadata: Metadata = {
  title: "RLTS-MM — Myanmar Logistics Tracking",
  description: "Real-Time Logistics Monitoring for Myanmar Trading — rapid prototype (B2 Assignment 5)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
