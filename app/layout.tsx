import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from './components/footer';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tech Stack Detector",
  description: "Generated by create next app. A simple tech stack detector.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Footer />
      </body>
    </html>
  );
}
