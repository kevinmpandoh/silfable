import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateAddress } from "./service.js";

test("x402 desktop blocks private, loopback, link-local and multicast addresses", () => {
  for (const address of ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.1.2", "172.16.1.2", "172.31.255.1", "192.168.1.2", "224.0.0.1", "::1", "fc00::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "172.15.1.2", "172.32.1.2", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(address), false, address);
  }
});
