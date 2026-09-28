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
const PactFinanceCard = dynamic(() => import("./PactFinanceCard"), { ssr: false });
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
  { id: "hero", name: "01 / The Pact" },
  { id: "demo", name: "02 / Funding" },
  { id: "how-it-works", name: "03 / Allocation" },
  { id: "ledger", name: "04 / Visibility" },
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

  const handleSimulateFunding = () => {
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
          <div className="logo-symbol">P</div>
          <span>pact</span>
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
          <span>Create a Pact</span>
          <ArrowRight size={16} />
        </button>
      </header>

      <main className="story-wrapper">
        {/* CHAPTER 01: HERO SECTION */}
        <section id="hero" className="hero-chapter">
          <div className="hero-content">
          

            <h1 className="hero-title">Know what is funded, due, and ready to pay.</h1>

            <p className="hero-subtitle">
              Pact turns an event budget into a live financial system for funding,
              vendor commitments, payment schedules, and payouts.
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
                placeholder="Work email address"
                aria-label="Work email address"
                autoComplete="email"
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
            <PactFinanceCard />

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
                  <strong style={{ fontSize: 13 }}>Funding coverage</strong>
                </div>
                <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>
                  See which obligations are funded before they become urgent.
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
                  <strong style={{ fontSize: 13 }}>Clear allocations</strong>
                </div>
                <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>
                  Every received dollar can be traced to an event obligation.
                </p>
              </motion.div>

              {/* Floating Pastel Micro-Card: Peach */}
              <motion.div
                className="floating-card card-peach"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>VENUE DEPOSIT</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>$8,000.00</div>
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

              {/* Floating event payment confirmation card */}
              <motion.div
                className="floating-image-card img-card-studio"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/event_payment.png" alt="Event payment confirmation" />
                <div className="image-card-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} color="var(--success)" />
                  <span>Vendor payment released</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Receipt recorded on Monad</div>
                </div>
              </motion.div>

              {/* Floating Pill Badge */}
              <motion.div
                className="floating-pill-badge pill-status"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="status-dot" />
                <span>Production payment · Fully funded</span>
              </motion.div>
            </div>

            {/* Accepted Payment Methods Bar */}
            <div className="accepted-methods-bar">
              <span>Funding sources:</span>
              <span className="method-tag">VISA</span>
              <span className="method-tag">MASTERCARD</span>
              <span className="method-tag">AMEX</span>
              <span className="method-tag">MONAD</span>
              <span className="method-tag">BASE</span>
              <span className="method-tag">SOLANA</span>
            </div>
          </div>
        </section>

        {/* CHAPTER 02: SPONSOR FUNDING (LIVE INTERACTIVE DEMO) */}
        <section id="demo" className="story-chapter">
          <div className="chapter-text-content">
            <span className="chapter-step-label">02 / Sponsor funding</span>
            <h2 className="chapter-heading">Fund the part of the event that matters.</h2>
            <p className="chapter-body">
              Sponsors see the event and obligation they are funding, choose an available payment source, and receive a clear receipt. Pact handles the cross-chain route underneath.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                <Check size={18} color="var(--success)" />
                <span>No manual bridging</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                <Check size={18} color="var(--success)" />
                <span>Committed and received stay distinct</span>
              </div>
            </div>
          </div>

          <div className="visual-panel-card">
            <div className="demo-funding-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
                <span>Pact sponsor funding preview</span>
                <span style={{ background: "var(--canvas)", padding: "2px 8px", borderRadius: 6, border: "1px solid var(--line)" }}>Interactive</span>
              </div>

              {/* Event and obligation summary */}
              <div className="demo-product-row">
                <img src="/ceramic_mug.png" alt="Ceramic Mug" />
                <div style={{ textAlign: "left" }}>
                  <strong style={{ fontSize: 16, display: "block" }}>Lagos Design Week</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Production · Stage and sound deposit</span>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "var(--ink)" }}>
                    3,000.00 <span style={{ fontSize: 13, fontWeight: 500 }}>USDC</span>
                  </div>
                </div>
              </div>

              {/* Route Selector Dropdown */}
              <div className="demo-route-selector">
                <label htmlFor="route-select">Choose payment source</label>
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
                <button className="demo-pay-btn" onClick={handleSimulateFunding}>
                  <span>Fund $3,000.00 USDC</span>
                  <ArrowRight size={16} />
                </button>
              )}

              {demoStage === "processing" && (
                <div style={{ padding: 16, background: "var(--canvas)", borderRadius: 16, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Funding in progress through Aurora Intents...</span>
                </div>
              )}

              {demoStage === "settled" && (
                <div>
                  <div className="demo-status-box">
                    <Check size={20} />
                    <span>Funding received. $3,000 is now available to allocate.</span>
                  </div>
                  <button
                    style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, textDecoration: "underline", marginTop: 12, cursor: "pointer" }}
                    onClick={() => setDemoStage("idle")}
                  >
                    Reset funding demo
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
                  <strong style={{ fontSize: 15, display: "block" }}>1. Organizer creates an event</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    The organizer records the budget, event date, funding sources, and obligations.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">2</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>2. Sponsor funds an obligation</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    The sponsor opens a funding link and chooses Base USDC, ETH, or SOL.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">3</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>3. Aurora Intent Execution</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Cross-chain funding settles as USDC into the event's financial system on Monad.
                  </span>
                </div>
              </div>

              <div className="pipeline-step-item active-step">
                <div className="step-num">4</div>
                <div>
                  <strong style={{ fontSize: 15, display: "block" }}>4. Funds become available</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    Pact verifies receipt, updates coverage, and makes eligible funds available to allocate.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="chapter-text-content">
            <span className="chapter-step-label">03 / Allocation and coverage</span>
            <h2 className="chapter-heading">A promise is not cash. Available cash is not free cash.</h2>
            <p className="chapter-body">
              Pact separates committed, received, available, and allocated money so organizers can spot a cash gap before a vendor payment is missed.
            </p>
            <div style={{ background: "var(--canvas)", border: "1px solid var(--line)", padding: 20, borderRadius: 20, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontWeight: 600 }}>
                <Lock size={18} color="var(--accent)" />
                <span>Programmable settlement</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Allocations, releases, receipts, and eligible refunds are represented on Monad while the interface stays focused on normal financial actions.
              </p>
            </div>
          </div>
        </section>

        {/* CHAPTER 04: THREE USERS, ONE FINANCIAL STATE */}
        <section id="ledger" className="story-chapter">
          <div className="chapter-text-content">
            <span className="chapter-step-label">04 / One financial state</span>
            <h2 className="chapter-heading">Organizers, sponsors, and vendors see what they need.</h2>
            <p className="chapter-body">
              Sponsors know what they funded. Vendors know what is covered and due. Organizers know whether the event can meet its next obligations.
            </p>
            <button className="header-action-button" onClick={() => scrollToChapter("hero")}>
              <span>Back to Top</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="visual-panel-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Sponsor view */}
              <div style={{ background: "var(--canvas)", padding: 20, borderRadius: 20, border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                  <span>SPONSOR FUNDING RECEIPT</span>
                  <span style={{ color: "var(--success)" }}>RECEIVED</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>3,000.00 USDC</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                  Funding Lagos Design Week production via Base
                </div>
                <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", marginTop: 8 }}>
                  Tx: 0x8a92...f3b1
                </div>
              </div>

              {/* Organizer view */}
              <div style={{ background: "var(--ink)", color: "#ffffff", padding: 20, borderRadius: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
                  <span>ORGANIZER COVERAGE VIEW</span>
                  <span style={{ color: "var(--mint)" }}>LIVE</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>$13,000 received · $3,500 gap</div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  $16,500 due within 14 days · Updated from verified funding
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
