"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Link2,
  ListChecks,
  Pause,
  Play,
  Send,
  ShieldCheck,
} from "lucide-react";

const demoSteps = [
  {
    id: "plan",
    label: "Build the funding plan",
    description: "Map every source to the vendor milestones and due dates it needs to cover.",
    icon: ListChecks,
  },
  {
    id: "fund",
    label: "Share a funding link",
    description: "Sponsors fund the event or a specific milestone from a clear contribution page.",
    icon: Link2,
  },
  {
    id: "verify",
    label: "Verify what arrived",
    description: "Pact counts money as received only after the payment has settled.",
    icon: ShieldCheck,
  },
  {
    id: "allocate",
    label: "Allocate received funds",
    description: "Move available money to the obligations it is meant to cover.",
    icon: CircleDollarSign,
  },
  {
    id: "pay",
    label: "Release the vendor payment",
    description: "Pay a fully funded milestone and keep a human-readable receipt.",
    icon: Send,
  },
] as const;

type StepId = (typeof demoSteps)[number]["id"];

function PlanVisual() {
  return <div className="demo-dashboard">
    <div className="demo-metrics">
      <div><span>Event budget</span><strong>$30,000</strong></div>
      <div><span>Received</span><strong>$13,000</strong></div>
      <div className="metric-alert"><span>Funding gap</span><strong>$3,500</strong></div>
    </div>
    <div className="demo-panel">
      <div className="demo-panel-heading"><strong>Vendor obligations</strong><span>3 milestones</span></div>
      <div className="demo-obligation"><span className="demo-avatar demo-avatar-peach">SS</span><div><strong>Stage & sound deposit</strong><span>Due Oct 4</span></div><div className="demo-status status-partial">Part funded</div></div>
      <div className="demo-obligation"><span className="demo-avatar demo-avatar-mint">VL</span><div><strong>Venue lock-in</strong><span>Due Oct 8</span></div><div className="demo-status status-covered">Covered</div></div>
      <div className="demo-obligation"><span className="demo-avatar demo-avatar-lilac">SC</span><div><strong>Security crew</strong><span>Due Oct 12</span></div><div className="demo-status">Not funded</div></div>
    </div>
  </div>;
}

function FundVisual() {
  return <div className="demo-funding-card">
    <div className="demo-link-row"><span><Link2 aria-hidden="true" /></span><div><small>Funding link</small><strong>pact.money/build-forward</strong></div><button type="button">Copied</button></div>
    <div className="demo-sponsor-mark">A</div>
    <p>Aurora Labs is funding</p>
    <h3>Stage & sound deposit</h3>
    <strong className="demo-amount">$5,000</strong>
    <div className="demo-source-row"><span>USDC · Base</span><span>Milestone contribution</span></div>
    <div className="demo-pay-action">Confirm contribution <ArrowRight aria-hidden="true" /></div>
  </div>;
}

function VerifyVisual() {
  return <div className="demo-verify">
    <div className="verify-orbit"><ShieldCheck aria-hidden="true" /><span>Settlement verified</span></div>
    <div className="verify-timeline">
      <div className="verify-row complete"><span><Check aria-hidden="true" /></span><div><strong>Contribution submitted</strong><small>Sponsor confirmed $5,000</small></div><time>10:41</time></div>
      <div className="verify-row complete"><span><Check aria-hidden="true" /></span><div><strong>Payment settled</strong><small>Confirmed on Base</small></div><time>10:42</time></div>
      <div className="verify-row active"><span><Check aria-hidden="true" /></span><div><strong>Funds marked received</strong><small>Now available to allocate</small></div><time>10:42</time></div>
    </div>
    <p className="demo-rule"><ShieldCheck aria-hidden="true" /> A promise never counts as cash.</p>
  </div>;
}

function AllocateVisual() {
  return <div className="demo-allocation">
    <div className="allocation-source"><span>Available to allocate</span><strong>$8,000</strong><small>Received and unallocated</small></div>
    <div className="allocation-arrow"><ArrowRight aria-hidden="true" /></div>
    <div className="allocation-target"><span>Stage & sound deposit</span><strong>$5,000 <small>of $5,000</small></strong><div className="allocation-track"><span /></div><p><Check aria-hidden="true" /> Fully funded</p></div>
    <div className="allocation-note"><CircleDollarSign aria-hidden="true" /><span><strong>$5,000 allocated</strong><small>$3,000 remains available</small></span></div>
  </div>;
}

function PayVisual() {
  return <div className="demo-receipt">
    <div className="receipt-check"><Check aria-hidden="true" /></div>
    <p>Vendor payment released</p>
    <strong className="demo-amount">$5,000</strong>
    <span className="receipt-pill">Paid</span>
    <dl>
      <div><dt>Vendor</dt><dd>Stage & Sound Co.</dd></div>
      <div><dt>Milestone</dt><dd>Production deposit</dd></div>
      <div><dt>Payment</dt><dd>5,000 USDC</dd></div>
      <div><dt>Receipt</dt><dd>PACT-1048</dd></div>
    </dl>
    <p className="receipt-note">The event plan and vendor view update together.</p>
  </div>;
}

function DemoVisual({ step }: { step: StepId }) {
  if (step === "fund") return <FundVisual />;
  if (step === "verify") return <VerifyVisual />;
  if (step === "allocate") return <AllocateVisual />;
  if (step === "pay") return <PayVisual />;
  return <PlanVisual />;
}

export default function PactDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const activeStep = demoSteps[activeIndex];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible || reduceMotion) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % demoSteps.length), 4300);
    return () => window.clearInterval(timer);
  }, [isPlaying, isVisible, reduceMotion]);

  const selectStep = (index: number) => {
    setActiveIndex(index);
    setIsPlaying(false);
  };

  return <section ref={sectionRef} id="funding-demo" className="demo-section" aria-labelledby="demo-heading">
    <div className="section-shell demo-shell">
      <div className="demo-intro">
        <div><h2 id="demo-heading">Follow the money from plan to payment.</h2></div>
        <p>One shared flow keeps organizers, sponsors, and vendors aligned on what was promised, what arrived, and what can be paid.</p>
      </div>

      <div className="demo-walkthrough">
        <div className="demo-stage" aria-live="polite">
          <div className="demo-stage-topbar"><div><span className="demo-brand-dot">P</span><span><small>Build Forward 2027</small><strong>{activeStep.label}</strong></span></div><span className="demo-live"><i /> Live plan</span></div>
          <div className="demo-stage-canvas">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="demo-scene"
                key={activeStep.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <DemoVisual step={activeStep.id} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="demo-stage-footer"><span>0{activeIndex + 1} / 0{demoSteps.length}</span><strong>{activeStep.description}</strong></div>
        </div>

        <div className="demo-controls">
          <div className="demo-controls-heading"><span>How it moves</span></div>
          <div className="demo-step-list">
            {demoSteps.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeIndex;
              return <button key={step.id} type="button" className={`demo-step-button${active ? " active" : ""}`} onClick={() => selectStep(index)} aria-pressed={active}>
                <span className="demo-step-rail"><span className="demo-step-icon"><Icon aria-hidden="true" /></span>{index < demoSteps.length - 1 && <span className="demo-step-line"><motion.i animate={{ scaleY: active && isPlaying && !reduceMotion ? 1 : 0 }} transition={{ duration: active ? 4.3 : 0.12, ease: "linear" }} /></span>}</span>
                <span className="demo-step-copy"><strong>{step.label}</strong><span>{step.description}</span></span>
              </button>;
            })}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
