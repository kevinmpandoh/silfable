"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, Download } from "lucide-react";
import Link from "next/link";

import { AtlasKicker, AtlasPanel, NetworkBadge, RouteNode, StatusMarker, WingMark } from "@/components/atlas/AtlasPrimitives";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section id="top" className="atlasHero">
      <div className="section-shell atlasHeroLayout">
        <motion.div className="atlasHeroCopy" initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .75 }}>
          <AtlasKicker tone="lilac">Robinhood Chain / Chain ID 4663</AtlasKicker>
          <h1>Trade Robinhood.<em>See every route.</em></h1>
          <div className="atlasHeroLead">
            <span className="atlasLeadLine" />
            <div>
              <p>Prepare supported trades on Robinhood Chain, move value across connected networks, and follow every transaction from fresh route data to final settlement.</p>
              <div className="atlasHeroActions">
                <Button asChild size="lg" className="atlasPrimaryButton"><Link href="/connect">Open workspace <ArrowDownRight className="ml-3 size-4" /></Link></Button>
                <Button asChild size="lg" className="atlasSecondaryButton"><Link href="/#download">Desktop app <Download className="ml-3 size-4" /></Link></Button>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div className="atlasHeroMap" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .85, delay: .12 }}>
          <WingMark />
          <AtlasPanel className="routeMapCard" tone="lilac">
            <div className="routeMapHeader">
              <div><AtlasKicker tone="lilac">Robinhood route specimen</AtlasKicker><p className="mt-2 text-sm text-[var(--atlas-muted)]">Request → review → settlement</p></div>
              <StatusMarker>Ready</StatusMarker>
            </div>
            <div className="routeMapTrack">
              <RouteNode label="Robinhood request" detail="Supported market action" tone="lilac" active />
              <RouteNode label="Route prepared" detail="Pinned venue · fresh RPC" tone="coral" active />
              <RouteNode label="EVM wallet confirmation" detail="Chain ID 4663" tone="citron" />
              <RouteNode label="Settlement tracked" detail="Receipt + final state" tone="aqua" />
            </div>
            <div className="routeMapBranch"><span>Swap</span><span>Bridge out</span><span>Bridge in</span></div>
          </AtlasPanel>
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
