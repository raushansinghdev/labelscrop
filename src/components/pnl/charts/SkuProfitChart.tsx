import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { formatCurrencyExact, formatNumber, formatPercent } from '../format';
import type { SkuRow } from '../types';
import { ChartCard, ChartTooltip } from './ChartCard';

interface SkuProfitChartProps {
	rows: SkuRow[];
}

interface Datum {
	/** Truncated for the axis; the tooltip carries the full SKU. */
	label: string;
	sku: string;
	profit: number;
	orders: number;
	margin: number | null;
	costMapped: boolean;
}

/** Enough rows to spot a pattern, few enough to stay readable on a phone. */
const TOP_N = 6;
const BOTTOM_N = 4;

export function SkuProfitChart({ rows }: SkuProfitChartProps) {
	if (rows.length === 0) return null;

	const sorted = [...rows].sort((a, b) => b.profit - a.profit);
	const best = sorted.slice(0, TOP_N);
	// The loss-makers are what a seller actually needs to act on, so they're picked from the
	// other end of the same sorted list rather than left to fall off a top-N cut.
	const worst = sorted.filter((r) => r.profit < 0).slice(-BOTTOM_N);

	const seen = new Set<string>();
	const shown: SkuRow[] = [];
	for (const row of [...best, ...worst]) {
		if (seen.has(row.sku)) continue;
		seen.add(row.sku);
		shown.push(row);
	}

	// Recharts draws a vertical bar chart from the bottom up, so the array has to be reversed
	// for the most profitable SKU to appear at the top.
	const data: Datum[] = shown
		.map((row) => ({
			label: row.sku.length > 16 ? `${row.sku.slice(0, 15)}…` : row.sku,
			sku: row.sku,
			profit: row.profit,
			orders: row.orders,
			margin: row.margin_pct,
			costMapped: row.cost_mapped,
		}))
		.reverse();

	return (
		<ChartCard
			title="Best and worst SKUs"
			caption="Profit per SKU after its own costs. Anything below the line is losing you money on every sale."
			badge={`${formatNumber(rows.length)} SKUs`}
		>
			{/* 24px a row rather than 30, so ten SKUs fit in 280px instead of 340. */}
			<div style={{ height: Math.max(180, data.length * 24 + 32) }} className="w-full">
				<ResponsiveContainer>
					<BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
						<CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
						<XAxis
							type="number"
							tick={{ className: 'fill-muted-foreground', fontSize: 10 }}
							axisLine={false}
							tickLine={false}
							tickFormatter={compactInr}
						/>
						<YAxis
							type="category"
							dataKey="label"
							tick={{ className: 'fill-muted-foreground', fontSize: 10 }}
							axisLine={false}
							tickLine={false}
							width={92}
						/>
						<Tooltip content={<SkuTooltip />} cursor={{ className: 'fill-muted/40' }} />
						<ReferenceLine x={0} className="stroke-border" />
						<Bar dataKey="profit" radius={3}>
							{data.map((entry) => (
								<Cell key={entry.sku} className={entry.profit >= 0 ? 'fill-chart-2' : 'fill-chart-3'} />
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</ChartCard>
	);
}

function compactInr(value: number): string {
	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';
	if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(1)}L`;
	if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}k`;
	return `${sign}₹${Math.round(abs)}`;
}

function SkuTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload;
	return (
		<ChartTooltip label={d.sku}>
			<p className={d.profit >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
				{formatCurrencyExact(d.profit)}
			</p>
			<p>
				{formatNumber(d.orders)} orders · {formatPercent(d.margin)} margin
			</p>
			{!d.costMapped && <p className="text-destructive">No cost recorded — this profit is overstated.</p>}
		</ChartTooltip>
	);
}
