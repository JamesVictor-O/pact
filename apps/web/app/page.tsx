"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

// SSR-Safe Dynamic Imports for WebGL Three.js Components
const Morva3DCard = dynamic(() => import("./Morva3DCard"), { ssr: false });
const CrossChain3DRing = dynamic(() => import("./CrossChain3DRing"), { ssr: false });

/* Interactive Ambient Canvas Component */
function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const orbs = [
      { x: width * 0.25, y: height * 0.3, radius: 280, color: "rgba(220, 242, 229, 0.45)", vx: 0.3, vy: 0.2 },
      { x: width * 0.75, y: height * 0.4, radius: 320, color: "rgba(248, 233, 168, 0.4)", vx: -0.2, vy: 0.3 },
      { x: width * 0.5, y: height * 0.7, radius: 360, color: "rgba(231, 227, 246, 0.35)", vx: 0.2, vy: -0.2 },
      { x: width * 0.85, y: height * 0.75, radius: 240, color: "rgba(45, 91, 255, 0.12)", vx: -0.3, vy: -0.1 },
    ];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;

        if (orb.x < -100 || orb.x > width + 100) orb.vx *= -1;
        if (orb.y < -100 || orb.y > height + 100) orb.vy *= -1;

        const gradient = ctx.createRadialGradient(
          orb.x,
          orb.y,
          0,
          orb.x,
          orb.y,
          orb.radius
        );
        gradient.addColorStop(0, orb.color);
        gradient.addColorStop(1, "rgba(250, 250, 248, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="ambient-canvas" />;
}

const chapters = [
  { id: "hero", name: "01 / The Link" },
  { id: "demo", name: "02 / The Checkout" },
  { id: "how-it-works", name: "03 / How It Works" },
  { id: "ledger", name: "04 / Two Sides" },
];

const routes = [
  { id: "base-usdc", label: "USDC on Base", estGas: "$0.01", time: "~2 sec" },
  { id: "eth-eth", label: "ETH on Ethereum", estGas: "$1.40", time: "~12 sec" },
  { id: "sol-sol", label: "SOL on Solana", estGas: "$0.005", time: "~1 sec" },
];

export default function Home() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [emailInput, setEmailInput] = useState("");
  const [selectedRoute, setSelectedRoute] = useState(routes[0].id);
  const [demoStage, setDemoStage] = useState<"idle" | "processing" | "settled">("idle");
  const reduced = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      chapters.forEach((ch, idx) => {
        const el = document.getElementById(ch.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveChapter(idx);
          }
        }
      });
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToChapter = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
  };

  const handleSimulatePayment = () => {
    setDemoStage("processing");
    setTimeout(() => {
      setDemoStage("settled");
    }, 2000);
  };

  return (
    <>
      <AmbientCanvas />

      {/* Comacard-Inspired Floating Capsule Glass Navbar */}
      <header className="site-header">
        <div className="logo">
          <div className="logo-symbol">M</div>
          <span>morva</span>
        </div>

        <nav aria-label="Main narrative navigation">
          {chapters.map((ch, idx) => (
            <button
              key={ch.id}
              className={activeChapter === idx ? "active" : ""}
              onClick={() => scrollToChapter(ch.id)}
            >
              {ch.name}
            </button>
          ))}
        </nav>

        <button className="header-action-button" onClick={() => scrollToChapter("demo")}>
          <span>Create Payment Link</span>
          <ArrowRight size={16} />
        </button>
      </header>

      <main className="story-wrapper">
        {/* CHAPTER 01: HERO SECTION */}
        <section id="hero" className="hero-chapter">
          <div className="hero-content">
          

            <h1 className="hero-title">The Future of Payments</h1>

            <p className="hero-subtitle">
              Enjoy Frictionless Spend Management With Morva Shareable Payment Links.
              Pay with any crypto &amp; get instant settlement on Monad in USDC.
            </p>

            {/* Email / Link Generator Input Bar */}
            <form
              className="hero-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                scrollToChapter("demo");
              }}
            >
              <Mail size={18} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <input
                type="email"
                placeholder="Your Email Address"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <button type="submit">
                <span>Get Started</span>
                <ArrowRight size={16} />
              </button>
            </form>

          </div>

          {/* WebGL 3D Interactive Card Scene & Responsive Micro Card Overlay */}
          <div className="hero-stage-container">
            {/* Real Three.js WebGL Interactive 3D Render */}
            <Morva3DCard />

            {/* Responsive Micro Cards & Real Image Badges */}
            <div className="hero-floating-grid">
              {/* Curved Pointer Arrows (Desktop Only) */}
              <svg className="curved-arrow arrow-yellow" viewBox="0 0 100 70" fill="none">
                <path d="M10,10 Q50,60 90,35" stroke="#16161A" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                <path d="M82,28 L91,36 L81,42" stroke="#16161A" strokeWidth="1.5" fill="none" />
              </svg>

              <svg className="curved-arrow arrow-mint" viewBox="0 0 100 70" fill="none">
                <path d="M90,10 Q50,60 10,35" stroke="#16161A" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                <path d="M18,28 L9,36 L19,42" stroke="#16161A" strokeWidth="1.5" fill="none" />
              </svg>

              {/* Floating Pastel Micro-Card: Butter */}
              <motion.div
                className="floating-card card-butter"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Sparkles size={16} />
                  <strong style={{ fontSize: 13 }}>Rewards Program</strong>
                </div>
                <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>
                  Rewards from brands you love with every Monad transfer.
                </p>
              </motion.div>

              {/* Floating Pastel Micro-Card: Mint */}
              <motion.div
                className="floating-card card-mint"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ShieldCheck size={16} />
                  <strong style={{ fontSize: 13 }}>Bank-Grade Security</strong>
                </div>
                <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>
                  We take your money matters seriously so that you don't have to.
                </p>
              </motion.div>

              {/* Floating Pastel Micro-Card: Peach */}
              <motion.div
                className="floating-card card-peach"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>INVOICE DUE</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>$200.00</div>
                <div style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", padding: "2px 8px", borderRadius: 99, display: "inline-block", marginTop: 4 }}>
                  Due in 2 days
                </div>
              </motion.div>

              {/* Floating Real Image Card 1: Handcrafted Ceramic Mug */}
              <motion.div
                className="floating-image-card img-card-mug"
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/ceramic_mug.png" alt="Handcrafted Ceramic Mug" />
                <div className="image-card-body">
                  <div>Ceramic Studio Mug</div>
                  <div style={{ color: "var(--accent)", fontWeight: 700 }}>$25.00 USDC</div>
                </div>
              </motion.div>

              {/* Floating Real Image Card 2: Merchant Studio Mobile Payment */}
              <motion.div
                className="floating-image-card img-card-studio"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/merchant_studio.png" alt="Merchant Payment Confirmation" />
                <div className="image-card-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} color="var(--success)" />
                    <span>Instant Settlement</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Verified via Monad Indexer</div>
                </div>
              </motion.div>

              {/* Floating Pill Badge */}
              <motion.div
                className="floating-pill-badge pill-status"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="status-dot" />
                <span>Payment reference 312 · Captured £2,000.00</span>
              </motion.div>
            </div>

            {/* Accepted Payment Methods Bar */}
            <div className="accepted-methods-bar">
              <span>Payment methods accepted:</span>
              <span className="method-tag">VISA</span>
              <span className="method-tag">MASTERCARD</span>
              <span className="method-tag">AMEX</span>
              <span className="method-tag">MONAD</span>
              <span className="method-tag">BASE</span>
              <span className="method-tag">SOLANA</span>
            </div>
          </div>
        </section>

        {/* CHAPTER 02: THE CHECKOUT (LIVE INTERACTIVE DEMO) */}
        <section id="demo" className="story-chapter">
          <div className="chapter-text-content">
            <span className="chapter-step-label">02 / The Checkout</span>
            <h2 className="chapter-heading">Step into their checkout.</h2>
            <p className="chapter-body">
              The amount stays the same. Your customer picks an available funding route from the assets they already hold on any supported chain. Morva handles cross-chain routing seamlessly.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                <Check size={18} color="var(--success)" />
                <span>Zero buyer friction</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                <Check size={18} color="var(--success)" />
                <span>Instant Monad USDC settlement</span>
              </div>
            </div>
          </div>

          <div className="visual-panel-card">
            <div className="demo-checkout-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                <span>Morva Link Checkout Preview</span>
                <span style={{ background: "var(--canvas)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}>Interactive</span>
              </div>

              {/* Merchant & Product Row with Real Ceramic Mug Image */}
              <div className="demo-product-row">
                <img src="/ceramic_mug.png" alt="Ceramic Mug" />
                <div style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: 16, display: "block" }}>Studio Forma</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Handcrafted Ceramic Mug · One piece</span>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "var(--ink)" }}>
                    25.00 <span style={{ fontSize: 13, fontWeight: 500 }}>USDC</span>
                  </div>
                </div>
              </div>

              {/* Route Selector Dropdown */}
              <div className="demo-route-selector">
                <label htmlFor="route-select">Select Funding Asset &amp; Chain:</label>
                <select
                  id="route-select"
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  disabled={demoStage !== "idle"}
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label} ({r.time})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Action Button */}
              {demoStage === "idle" && (
                <button className="demo-pay-btn" onClick={handleSimulatePayment}>
                  <span>Pay $25.00 USDC</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {demoStage === "processing" && (
                <div style={{ padding: 16, background: "var(--canvas)", borderRadius: 16, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Executing Aurora Intent &amp; Indexing Transfer...</span>
                </div>
              )}

              {demoStage === "settled" && (
                <div>
                  <div className="demo-status-box">
                    <Check size={20} />
                    <span>Payment Verified! Link marked PAID on Monad.</span>
                  </div>
                  <button
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, textDecoration: "underline", marginTop: 12, cursor: "pointer" }}
                    onClick={() => setDemoStage("idle")}
                  >
                    Reset Interactive Demo
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CHAPTER 03: HOW IT WORKS (3D CROSS-CHAIN RING & VERIFICATION PIPELINE) */}
        <section id="how-it-works" className="story-chapter">
          <div className="visual-panel-card">
            {/* Real Three.js WebGL 3D Rotating Ribbon Ring */}
            <CrossChain3DRing />

            <div className="pipeline-steps" style={{ marginTop: 20 }}>
              <div className="pipeline-step-item active-step">
                <div className="step-num">1</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>1. Merchant Creates Payment Link</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Merchant inputs amount ($25.00) and Monad USDC settlement preference.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">2</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>2. Buyer Chooses Funding Asset</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Buyer opens <code style={{ background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: 4 }}>/pay/:id</code> and selects Base USDC, ETH, or SOL.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">3</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>3. Aurora Intent Execution</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Cross-chain intent routes and settles USDC directly to merchant's Monad address.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">4</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>4. Independent Envio Verification</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Envio indexes Monad block. Morva backend matches tx identity and marks link paid in 1 DB tx.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="chapter-text-content">
            <span className="chapter-step-label">03 / The Verification</span>
            <h2 className="chapter-heading">A payment isn't paid until it's verified.</h2>
            <p className="chapter-body">
              Morva checks the transfer on Monad before updating the link. A wallet confirmation alone doesn't close the sale—independent backend indexing guarantees security.
            </p>
            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: 20, borderRadius: 20, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontWeight: 600 }}>
                <Lock size={18} color="var(--accent)" />
                <span>Non-Custodial Guarantee</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Morva never holds payment funds. Funds transfer directly on-chain to the merchant's recorded Monad address.
              </p>
            </div>
          </div>
        </section>

        {/* CHAPTER 04: TWO SIDES, ONE RAIL */}
        <section id="ledger" className="story-chapter">
          <div className="chapter-text-content">
            <span className="chapter-step-label">04 / Two Sides, One Rail</span>
            <h2 className="chapter-heading">Their confirmation. Your peace of mind.</h2>
            <p className="chapter-body">
              One payment connects two views. The buyer knows it's complete with an instant digital receipt. The merchant knows exactly what arrived in their Monad settlement wallet.
            </p>
            <button className="header-action-button" onClick={() => scrollToChapter("hero")}>
              <span>Back to Top</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="visual-panel-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Buyer View Box */}
              <div style={{ background: "var(--canvas)", padding: 20, borderRadius: 20, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                  <span>BUYER CONFIRMATION RECEIPT</span>
                  <span style={{ color: "var(--success)" }}>COMPLETED</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>25.00 USDC</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Paid to Studio Forma via Base Route
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", marginTop: 8 }}>
                  Tx: 0x8a92...f3b1
                </div>
              </div>

              {/* Merchant View Box */}
              <div style={{ background: "var(--ink)", color: "#ffffff", padding: 20, borderRadius: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
                  <span>MERCHANT SETTLEMENT LEDGER</span>
                  <span style={{ color: "var(--mint)" }}>SETTLED ON MONAD</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>+$25.00 USDC</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  Matched Link #1042 · Envio Indexer Verified
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
