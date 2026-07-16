export type TickerData = {
  symbol: string;
  price: string;
  change24h: string;
};

type TickerProps = {
  data?: TickerData;
};

const defaultTicker: TickerData = {
  symbol: "$SILF",
  price: "$0.006198",
  change24h: "-27.56%",
};

function TickerItem({ data }: { data: TickerData }) {
  return (
    <span className="flex shrink-0 items-center gap-5 px-5 sm:gap-8 sm:px-8" aria-hidden="true">
      <span className="font-semibold">{data.symbol}</span>
      <span className="font-mono">{data.price}</span>
      <span className="font-mono">{data.change24h}</span>
      <span className="text-[10px] uppercase tracking-[0.24em] text-white/70">24h</span>
      <span className="size-1.5 rounded-full bg-white" />
    </span>
  );
}

export function Ticker({ data = defaultTicker }: TickerProps) {
  return (
    <aside
      aria-label={`${data.symbol} market ticker: ${data.price}, ${data.change24h} over 24 hours`}
      className="overflow-hidden border-y border-blue-400/50 bg-electric py-3.5 text-white"
    >
      <div className="ticker-track flex w-max items-center font-sans text-xs uppercase tracking-[0.16em] sm:text-sm">
        <div className="flex shrink-0 items-center">
          {Array.from({ length: 6 }, (_, index) => (
            <TickerItem key={`primary-${index}`} data={data} />
          ))}
        </div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <TickerItem key={`clone-${index}`} data={data} />
          ))}
        </div>
      </div>
    </aside>
  );
}
