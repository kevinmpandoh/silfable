"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, Orbit, Radar, Route, ScanSearch } from "lucide-react";

import { AtlasKicker, AtlasPanel } from "@/components/atlas/AtlasPrimitives";

const branches = [
  { title: "Swap", text: "Prepare a fresh Robinhood Chain market route with allowance, gas, limits, and expected output gathered into one review.", icon: ArrowLeftRight, tone: "lilac" as const },
  { title: "Bridge", text: "Move supported assets between Robinhood Chain and Solana while tracking source confirmation and destination settlement separately.", icon: Route, tone: "coral" as const },
  { title: "Explore", text: "Use connected Solana workflows for swaps, token launches, research, and review-based automation proposals.", icon: Orbit, tone: "aqua" as const },
];

export function FeatureGrid() {
  return (
    <section className="atlasSection">
      <div className="section-shell">
        <div className="atlasSectionHeader">
          <div><AtlasKicker tone="coral">Robinhood-first workflow map</AtlasKicker><h2>Built around Robinhood.<br />Connected beyond it.</h2></div>
          <p>Robinhood Chain is the primary trading environment. Solana remains connected for liquidity routes, token launch, and two-way settlement.</p>
        </div>
        <div className="journeyMap">
          <AtlasPanel className="journeyEndpoint" tone="aqua">
            <div className="journeyIconWrap"><span className="journeyIcon atlasTone-aqua"><Radar /></span></div>
            <div className="journeyCardBody"><AtlasKicker tone="aqua">Start / Define</AtlasKicker><h3>Choose the move.</h3><p>Start with a supported market objective, then resolve the active network, wallet, asset, amount, and destination.</p></div>
          </AtlasPanel>

          <div className="journeyBranches">
            {branches.map((branch, index) => {
              const Icon = branch.icon;
              return <motion.article key={branch.title} className={`journeyBranch atlasTone-${branch.tone}`} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .1 }}>
                <div className="journeyIconWrap"><span className="journeyIcon"><Icon /></span></div>
                <div className="journeyCardBody"><AtlasKicker tone={branch.tone}>Route / {String(index + 1).padStart(2, "0")}</AtlasKicker><h3>{branch.title}</h3><p>{branch.text}</p></div>
              </motion.article>;
            })}
          </div>

          <AtlasPanel className="journeyEndpoint" tone="citron">
            <div className="journeyIconWrap"><span className="journeyIcon atlasTone-citron"><ScanSearch /></span></div>
            <div className="journeyCardBody"><AtlasKicker tone="citron">Finish / Track</AtlasKicker><h3>Know the result.</h3><p>Separate preparation, wallet confirmation, broadcast, and final settlement in the activity record.</p></div>
          </AtlasPanel>
        </div>
      </div>
    </section>
  );
}
