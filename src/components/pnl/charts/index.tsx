import { motion } from 'motion/react';
import { STAGGER_LIST } from '../motion';
import type { PnlResult } from '../types';
import { PnlWaterfall } from './PnlWaterfall';
import { SkuProfitChart } from './SkuProfitChart';
import { StatusDonut } from './StatusDonut';

/**
 * Every chart behind one default export, so the island can pull the whole set in a single
 * `lazy()` chunk that only loads once a file has been parsed.
 *
 * The stagger is deliberate here: the charts arrive after the KPI cards have already settled,
 * which is exactly the order they should be read in.
 */
export default function ProfitCharts({
	result,
	overheads,
	onOpenProducts,
}: {
	result: PnlResult;
	overheads: number;
	/** Handed down to the SKU chart, the one card that links out of the overview. */
	onOpenProducts: () => void;
}) {
	return (
		<motion.div variants={STAGGER_LIST} initial="hidden" animate="show" className="space-y-4">
			{/* Donut left, waterfall right. Full width, the waterfall's seven bars stretched into a
			  * wall of colour with acres of white space between them; at two thirds it reads as a
			  * chart again, and the donut earns the third that it frees up instead of sitting in a
			  * band of its own. They stack on anything narrower than a laptop. */}
			<div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
				<StatusDonut breakdown={result.status_breakdown} />
				<PnlWaterfall overall={result.overall} overheads={overheads} />
			</div>
			<SkuProfitChart rows={result.sku_rows} onOpenProducts={onOpenProducts} />
		</motion.div>
	);
}
