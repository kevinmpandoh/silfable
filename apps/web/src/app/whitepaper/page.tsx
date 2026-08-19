import type { Metadata } from "next";
import DocsPage from "@/components/DocsPage";

export const metadata: Metadata = {
  title: "Mirae Whitepaper | Execution Workspace Reference",
  description:
    "Autonomous markets, in your control. The Mirae whitepaper: runtime loop, agent engine, policy engine, intent execution, economics, security and roadmap.",
};

export default function Whitepaper() {
  return <DocsPage />;
}
