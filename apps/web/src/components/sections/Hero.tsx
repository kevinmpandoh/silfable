"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { AtlasKicker, NetworkBadge } from "@/components/atlas/AtlasPrimitives";
import { Button } from "@/components/ui/button";

export function Hero() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    let animationFrame = 0;
    let previousTime = 0;
    let reversing = false;

    const playForward = () => {
      reversing = false;
      previousTime = 0;
      void video.play().catch(() => undefined);
    };

    const reverseFrame = (time: number) => {
      if (!reversing) return;
      if (!previousTime) previousTime = time;
      const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      video.currentTime = Math.max(0, video.currentTime - elapsedSeconds);

      if (video.currentTime <= 0.02) {
        video.currentTime = 0;
        playForward();
        return;
      }

      animationFrame = requestAnimationFrame(reverseFrame);
    };

    const playBackward = () => {
      video.pause();
      reversing = true;
      previousTime = 0;
      animationFrame = requestAnimationFrame(reverseFrame);
    };

    video.addEventListener("ended", playBackward);
    void video.play().catch(() => undefined);

    return () => {
      reversing = false;
      cancelAnimationFrame(animationFrame);
      video.removeEventListener("ended", playBackward);
    };
  }, [reduceMotion]);

  return (
    <section id="top" className="atlasHero">
      <div className="atlasHeroBackground" aria-hidden="true">
        <video
          ref={videoRef}
          className="atlasHeroBackgroundVideo"
          autoPlay={!reduceMotion}
          muted
          playsInline
          preload="metadata"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="section-shell atlasHeroLayout">
        <motion.div className="atlasHeroCopy" initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .75 }}>          
          <h1>Set the strategy.<em>Let the runtime handle execution.</em></h1>
          <div className="atlasHeroLead">
            <span className="atlasLeadLine" />
            <div>
              <p>Build to run locally on your machine, Mission Mode can operate autonomously for days while every swap and bridge remains subject to the same fail-closed safety controls.</p>
              <div className="atlasHeroActions">
                <Button asChild size="lg" className="atlasPrimaryButton"><Link href="/connect">Open workspace <ArrowDownRight className="ml-3 size-4" /></Link></Button>
                <Button asChild size="lg" className="atlasSecondaryButton"><Link href="/#download">Desktop app <Download className="ml-3 size-4" /></Link></Button>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      <div className="atlasProofStrip">
        <div className="section-shell atlasProofGrid">
          <div className="atlasProofItem"><AtlasKicker tone="coral">Living Atlas / 01</AtlasKicker><span>Every supported workflow stays visible.</span></div>
          <div className="atlasProofItem"><NetworkBadge tone="lilac">Robinhood Chain</NetworkBadge><span>Primary ecosystem · ID 4663</span></div>
          <div className="atlasProofItem"><NetworkBadge tone="aqua">Connected to Solana</NetworkBadge><span>Swap + launch + bridge</span></div>
          <div className="atlasProofItem"><strong>Web + desktop</strong><span>Two signing surfaces</span></div>
        </div>
      </div>
    </section>
  );
}
