# Silfable: Cross-Chain EVM & Robinhood Chain Implementation Roadmap

## 1. Pendahuluan
Dokumen ini adalah peta jalan (roadmap) teknis yang komprehensif untuk mengimplementasikan dukungan **Cross-Chain EVM** pada project Silfable, sesuai dengan visi di Whitepaper. Saat ini, Silfable beroperasi secara eksklusif di ekosistem Solana (Solana Mainnet, Jupiter Swap, Pump.fun). 

Dengan ekspansi EVM, Silfable akan mampu melakukan trading otonom 24/7 di jaringan Layer-2 terkemuka seperti **Robinhood Chain**, Arbitrum, Base, dan Ethereum Mainnet. Dokumen ini memastikan implementasi terarah, aman, dan selaras dengan arsitektur *Ephemeral Vault* saat ini.

---

## 2. Arsitektur: Solana vs EVM (Robinhood Chain)

### Kondisi Saat Ini (Solana-First)
- **Kriptografi:** Ed25519 Keypairs (`@solana/web3.js`).
- **Routing:** Jupiter v6 Aggregator.
- **Satuan Nilai:** Lamports (1 SOL = 10^9 Lamports).
- **Kecepatan & Finality:** ~400ms block time, polling RPC langsung untuk rekonsiliasi.

### Target Arsitektur (Cross-Chain EVM)
- **Kriptografi:** Secp256k1 Private Keys / Mnemonic (`viem` atau `ethers.js`).
- **Routing:** Uniswap V3 Router, 1inch Aggregator, atau DEX Native di Robinhood Chain.
- **Satuan Nilai:** Wei (1 ETH = 10^18 Wei). Perlu kewaspadaan tinggi karena EVM menggunakan presisi 18 desimal (BigInt) dibandingkan Solana yang 9 desimal.
- **Kecepatan & Finality:** Tergantung Layer-2 (misal Robinhood Chain menggunakan Arbitrum stack dengan ~100ms block time, tapi finality ke L1 butuh waktu).

---

## 3. Pembaruan Skema Database (Prisma)
Agar tidak merusak kompatibilitas Solana, model database harus dibuat polimorfik atau ditambahkan field spesifik rantai jaringan.

### `AgentSession` (Pembaruan)
Penyimpanan *Ephemeral Vault* harus mendukung kunci EVM.
```prisma
model AgentSession {
  // ... field lama ...
  network                String     @default("SOLANA") // Opsi: "SOLANA", "ROBINHOOD_CHAIN", "ARBITRUM", "BASE"
  
  // Vault EVM
  encryptedEvmPrivateKey String?    // AES-256-GCM
  evmIv                  String?
  
  // Limitasi (Ubah nama variabel atau gunakan standar abstrak)
  maxAllocationBaseUnit  String     // Menggantikan maxAllocationLamports (Bisa berupa Wei atau Lamports)
  peakBalanceBaseUnit    String     @default("0")
  currentBalanceBaseUnit String     @default("0")
}
```
*Catatan:* Variabel berakhiran `Lamports` secara bertahap diganti dengan `BaseUnit` agar fleksibel antara Wei (EVM) dan Lamports (Solana).

### `TradeLog` & `PositionStrategy`
Tambahkan field `network` atau `chainId` untuk pelacakan receipt yang akurat. Kolom `txHash` pada EVM memiliki format `0x...` yang berbeda dari Base58 Solana.

---

## 4. Perombakan Cloud Worker & Task Queue
Cloud Worker (Node.js daemon) saat ini sangat terikat erat dengan eksekusi Solana. 

### Modul Eksekusi (*Execution Engine*)
Sistem perlu menggunakan **Strategy Pattern** untuk *Transaction Builder*:
1. **SolanaEngine:** Menggunakan `@solana/web3.js` & `VersionedTransaction`.
2. **EvmEngine:** Menggunakan `viem` `createWalletClient` & `http` transport.

### Alur Eksekusi Intent AI
1. AI membaca intent (misal: "Beli $10 token RWA di Robinhood Chain").
2. AI menghasilkan JSON Contract dengan spesifikasi `network: "ROBINHOOD_CHAIN"`.
3. Cloud Worker memparsing JSON. Jika `network !== "SOLANA"`, worker meneruskan payload ke `EvmEngine`.
4. `EvmEngine` mendekripsi `encryptedEvmPrivateKey` di memori, membangun transaksi (via Router DEX terkait), melakukan *gas estimation*, dan *sign*.
5. Transaksi di-broadcast ke RPC Robinhood Chain.
6. Worker melakukan *polling* (menunggu *receipt* dengan `viem` `waitForTransactionReceipt`).

---

## 5. Fitur Utama & Fase Implementasi

### Fase 1: Fondasi Kriptografi EVM & Database
- **Tugas:** Menambahkan fungsionalitas pembuatan Wallet EVM secara acak saat *Agent Session* dimulai.
- **Tugas:** Menerapkan fungsi enkripsi/dekripsi AES-256-GCM untuk Secp256k1 (private key `0x...`).
- **Tugas:** Migrasi skema Prisma (`Lamports` ke `BaseUnit`).

### Fase 2: Integrasi Robinhood Chain RPC & Viem
- **Tugas:** Menginisiasi klien `viem` dengan custom RPC URL untuk Robinhood Chain.
- **Tugas:** Mengimplementasikan pengecekan saldo asli (ETH/Gas) dan ERC20 balances.
- **Tugas:** Pembuatan sistem batas *Slippage* dan *Gas Price / Priority Fee Ceiling* khusus EVM (mencegah *gas spike*).

### Fase 3: Integrasi DEX & Swapper L2
- **Tugas:** Riset DEX likuiditas utama di Robinhood Chain (kemungkinan *fork* Uniswap V2/V3).
- **Tugas:** Implementasi pemanggilan fungsi `swapExactTokensForTokens` atau `exactInputSingle`.
- **Tugas:** Simulasi transaksi (`eth_call` / `estimateGas`) sebelum penandatanganan final (mencegah *revert*).

### Fase 4: Frontend UI (Web Client)
- **Tugas:** Menambahkan *Network Switcher* di halaman `/trade` (Solana, Robinhood Chain, dll).
- **Tugas:** Memperbarui antarmuka dompet (mendukung `0x...` address selain Base58 Solana).
- **Tugas:** Menyesuaikan UI *Trade History* agar terhubung dengan Block Explorer Robinhood Chain / Arbitrum.

---

## 6. Manajemen Risiko (Risk Management) EVM
Penting untuk menerapkan *Kill Switch* yang sama seperti pada Solana:
1. **Max Drawdown:** Hitung PnL harian dalam USD (memerlukan *Oracle* atau *Price Feed* yang mendukung ERC20 di Robinhood Chain).
2. **Tx Approval Allowance:** Pada EVM, token ERC20 harus di-`approve` ke DEX sebelum ditukar. Agen AI **HANYA** boleh melakukan `approve` dengan jumlah yang sama persis dengan yang akan ditukar (*Exact Approval*), **JANGAN PERNAH** melakukan `Max Uint256 Approval` untuk meminimalisir risiko eksploitasi DEX L2.
3. **Gas Limit Ceiling:** Cegah transaksi gagal dengan menetapkan batas atas *baseFee* dan *maxPriorityFeePerGas*.

---

## 7. Hasil yang Diharapkan
- Pengguna dapat menyetor aset ke **EVM Ephemeral Vault**.
- AI dapat membaca data harga dan tren di jaringan Robinhood Chain.
- AI dapat secara otonom melakukan eksekusi swap token 24/7 di Robinhood Chain menggunakan antrean tugas (*task queue*) di latar belakang, sepenuhnya terisolasi dan dibatasi oleh parameter risiko (*Max Drawdown*).
- Riwayat transaksi (termasuk biaya gas L2) tercatat presisi di Cloud Database.

Dengan roadmap ini, pengembangan akan tetap fokus, modular, dan tidak merusak fungsionalitas inti Solana yang sudah berjalan stabil.
