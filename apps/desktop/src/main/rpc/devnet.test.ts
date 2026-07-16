import assert from "node:assert/strict";
import test from "node:test";

import {
  DevnetWalletRpcService,
  NetworkHealthMonitor,
  type DevnetRpcPort,
} from "./devnet";

class FakeRpc implements DevnetRpcPort {
  latencyMs = 25;
  shouldFail = false;
  balance = 2_500_000_000n;
  airdropCalls = 0;

  async probeHealth() {
    if (this.shouldFail) throw new Error("offline");
    return { latencyMs: this.latencyMs };
  }

  async getBalance() {
    return this.balance;
  }

  async requestAirdrop() {
    this.airdropCalls += 1;
    return "5".repeat(88);
  }
}

test("network monitor becomes offline after the first failed probe", async () => {
  const rpc = new FakeRpc();
  const monitor = new NetworkHealthMonitor(rpc);
  assert.equal((await monitor.checkNow()).health, "healthy");
  rpc.shouldFail = true;
  assert.equal((await monitor.checkNow()).health, "offline");
});

test("slow successful probes are degraded, not healthy", async () => {
  const rpc = new FakeRpc();
  rpc.latencyMs = 3_500;
  assert.equal((await new NetworkHealthMonitor(rpc).checkNow()).health, "degraded");
});

test("balance reads require a healthy monitor", async () => {
  const rpc = new FakeRpc();
  const monitor = new NetworkHealthMonitor(rpc);
  const service = new DevnetWalletRpcService({
    rpc,
    health: monitor,
    getWalletAddress: async () => "11111111111111111111111111111111",
  });
  await assert.rejects(service.getBalance(), /network is not healthy/u);
  await monitor.checkNow();
  const result = await service.getBalance();
  assert.equal(result.lamportsAtomic, "2500000000");
});

test("manual faucet is fixed to one request per cooldown window", async () => {
  const rpc = new FakeRpc();
  const monitor = new NetworkHealthMonitor(rpc);
  await monitor.checkNow();
  const service = new DevnetWalletRpcService({
    rpc,
    health: monitor,
    getWalletAddress: async () => "11111111111111111111111111111111",
  });
  await service.requestOneSolAirdrop();
  await assert.rejects(service.requestOneSolAirdrop(), /cooldown is active/u);
  assert.equal(rpc.airdropCalls, 1);
});
