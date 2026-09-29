"use client";

import Image from "next/image";
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";

const audiences = [
  { id: "organizers", number: "01", label: "For organizers", title: "Know whether the event can meet its next obligation.", body: "See commitments, received cash, allocations, due dates, and funding gaps in one live plan.", image: "/for-organizers.png", alt: "Two event organizers reviewing a venue plan during setup", tone: "peach" },
  { id: "sponsors", number: "02", label: "For sponsors", title: "See exactly what your contribution makes possible.", body: "Fund the event or a specific milestone, then follow the contribution from received to deployed.", image: "/for-sponsors.png", alt: "Two sponsors reviewing an event contribution from a venue lounge", tone: "butter" },
  { id: "vendors", number: "03", label: "For vendors", title: "Know when your next payment is fully funded.", body: "Track each contract milestone by amount, due date, funding status, and payment status.", image: "/for-vendors.png", alt: "Two production vendors checking a payment backstage", tone: "mint" },
] as const;

/*
  Scroll storyboard
  0%–22%   — organizer card holds the stage
  22%–42%  — sponsor card flips up; organizer card recedes
  42%–55%  — sponsor card holds the stage
  55%–75%  — vendor card flips up; sponsor card recedes
  75%–100% — vendor card holds, then normal page scrolling resumes
*/
const STACK = {
  sponsorEnter: [0.22, 0.42] as [number, number],
  vendorEnter: [0.55, 0.75] as [number, number],
  incomingY: "108%",
  incomingRotate: 2.2,
  restingScale: 0.965,
};

function AudienceCard({ audience, index, progress }: { audience: (typeof audiences)[number]; index: number; progress: MotionValue<number> }) {
  const enter = index === 1 ? STACK.sponsorEnter : STACK.vendorEnter;
  const nextEnter = index === 0 ? STACK.sponsorEnter : STACK.vendorEnter;
  const y = useTransform(progress, enter, index === 0 ? ["0%", "0%"] : [STACK.incomingY, "0%"]);
  const rotate = useTransform(progress, enter, index === 0 ? [0, 0] : [STACK.incomingRotate, 0]);
  const scale = useTransform(progress, index === 2 ? [0, 1] : nextEnter, index === 2 ? [1, 1] : [1, STACK.restingScale]);

  return <motion.article className={`audience-stack-card audience-tone-${audience.tone}`} style={{ y, rotate, scale, zIndex: index + 1 }}>
    <div className="audience-stack-image"><Image src={audience.image} alt={audience.alt} fill sizes="(max-width: 960px) 100vw, 54vw" /><span aria-hidden="true">{audience.number}</span></div>
    <div className="audience-stack-copy"><p className="audience-label">{audience.label}</p><h3>{audience.title}</h3><p>{audience.body}</p><a className="audience-link" href="#funding-demo">See the flow <ArrowUpRight aria-hidden="true" /></a></div>
  </motion.article>;
}

function StaticAudienceCards() {
  return <div className="audience-static-list">{audiences.map((audience) => <article className={`audience-stack-card audience-tone-${audience.tone}`} key={audience.id}>
    <div className="audience-stack-image"><Image src={audience.image} alt={audience.alt} fill sizes="100vw" /><span aria-hidden="true">{audience.number}</span></div>
    <div className="audience-stack-copy"><p className="audience-label">{audience.label}</p><h3>{audience.title}</h3><p>{audience.body}</p><a className="audience-link" href="#funding-demo">See the flow <ArrowUpRight aria-hidden="true" /></a></div>
  </article>)}</div>;
}

export default function PeopleSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  if (reduceMotion) return <section ref={sectionRef} id="for-everyone" className="people people-static section-shell" aria-labelledby="people-heading">
    <div className="people-stack-heading"><div><p className="eyebrow">One event, three clear views</p><h2 id="people-heading">Everyone sees the financial state they need.</h2></div></div><StaticAudienceCards />
  </section>;

  return <section ref={sectionRef} id="for-everyone" className="people people-stack" aria-labelledby="people-heading">
    <div className="people-sticky section-shell">
      <div className="people-stack-heading"><div><p className="eyebrow">One event, three clear views</p><h2 id="people-heading">One plan. The right view for everyone.</h2></div><div className="people-scroll-cue"><span>Scroll to flip through the views</span><span className="people-progress"><motion.i style={{ scaleX: scrollYProgress }} /></span><strong>03</strong></div></div>
      <div className="audience-stack">{audiences.map((audience, index) => <AudienceCard audience={audience} index={index} progress={scrollYProgress} key={audience.id} />)}</div>
    </div>
  </section>;
}
