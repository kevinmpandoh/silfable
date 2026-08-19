import Link from "next/link";
import { HeroContract } from "./HeroContract";

const metaItems = ["Swaps", "Launch", "Bridge", "Automation", "Connected EVM"];

export function Hero() {
  return (
    <section id="top" className="brightHero">
      <video
        className="brightHeroVideo"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/mirae-character.jpeg"
        aria-hidden="true"
      >
        <source src="/hero2.mp4" type="video/mp4" />
      </video>
      <div className="brightHeroVeil" aria-hidden="true" />
      <div className="brightHeroFrame">
        <div className="brightHeroContent">
          <p className="brightHeroEyebrow">Locally Run On-chain Workspace</p>
          <h1>Move on-chain.<br /><em>Keep the final say.</em></h1>
          <p className="brightHeroLead">Coordinate swaps, launches, bridges, and automation from a single workspace that runs locally. Mirae builds the execution path while your wallet keeps control of every signature.</p>
          <div className="brightHeroActions">
            <Link href="/connect" className="brightPrimaryAction">Open Workspace</Link>
            <Link href="/releases" className="brightSecondaryAction">Download</Link>
          </div>
          <HeroContract />
          <p className="brightHeroTrust">Every action is reviewed by you before it runs. Signing in never approves a later transaction.</p>
          <ul className="brightHeroMeta" aria-label="Supported operator capabilities">
            {metaItems.map((item, index) => <li key={item}>{index > 0 && <i aria-hidden="true" />}{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
