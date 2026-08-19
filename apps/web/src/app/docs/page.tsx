import type { Metadata } from "next";

import ReferenceDocsPage from "@/components/docs/ReferenceDocsPage";

export const metadata: Metadata = {
  title: "Mirae Docs | Execution Workspace Reference",
  description:
    "The Mirae reference documentation: runtime loop, wallet approval model, route planning, bounded automation, local runtime, fees, security and roadmap.",
};

export default function DocsPage() {
  return <ReferenceDocsPage />;
}
