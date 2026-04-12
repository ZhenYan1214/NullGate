import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Nav } from "./components/Nav";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ZK-RWA Allowlist",
  description: "ERC-3643 for institutions that actually care about privacy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <div className="app-bg" aria-hidden />
        <div className="app-shell">
          <header className="site-header">
            <div className="site-header__inner">
              <Link href="/" className="brand">
                <span className="brand__mark" aria-hidden />
                <span className="brand__text">
                  <span className="brand__name">ZK-RWA</span>
                  <span className="brand__tag">Allowlist</span>
                </span>
              </Link>
              <Nav />
            </div>
          </header>
          <main className="container">{children}</main>
          <footer className="site-footer">
            <div className="site-footer__inner">
              <p className="site-footer__line">
                HashKey Chain testnet · Semaphore v4 · On-Chain Horizon
              </p>
              <p className="site-footer__muted">Institutional allowlist privacy without sacrificing ERC-20 ergonomics.</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
