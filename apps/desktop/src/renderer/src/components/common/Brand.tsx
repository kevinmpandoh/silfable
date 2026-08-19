export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`setupBrand ${compact ? "compact" : ""}`}>
      <BrandMark />
      <div>
        <strong className="desktopWordmark" aria-label="Mirae">MIRΛE</strong>
        <small>Mainnet intelligence</small>
      </div>
    </div>
  );
}

export function BrandMark({ large: _large = false }: { large?: boolean }) {
  return null;
}

export function CornerFooter() {
  return (
    <div className="cornerFooter">
      <span>Local-first · policy enforced</span>
      <span>MAINNET</span>
    </div>
  );
}
