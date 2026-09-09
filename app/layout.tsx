import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroTrash — Clean campus. Real rewards.",
  description: "Report, clean and weigh campus waste to earn redeemable credits.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
