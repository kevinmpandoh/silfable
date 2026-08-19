"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/sections/Navbar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  if (pathname === "/trade" || pathname === "/whitepaper") {
    return null;
  }
  return <Navbar />;
}
