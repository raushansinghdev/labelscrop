import {
	ArrowDownIcon,
	ArrowUpIcon,
	BarcodeIcon,
	CheckIcon,
	ChevronDownIcon,
	ChevronsUpDownIcon,
	FileTextIcon,
	ListOrderedIcon,
	MapPinIcon,
	PaletteIcon,
	RulerIcon,
	ScissorsIcon,
	SlidersHorizontalIcon,
	TagIcon,
	TruckIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { type OptionChoice, type OptionConfig, type OptionField, visibleFields } from '@/lib/options/schema';

interface OptionsFormProps {
	fields: OptionField[];
	config: OptionConfig;
	/** Whether the "More options" section (every `simpleModeVisible: false` field) is expanded. */
	advancedOpen: boolean;
	onAdvancedOpenChange: (open: boolean) => void;
	onChange: (id: string, value: string | boolean) => void;
	disabled?: boolean;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Height+fade for fields that appear/disappear via `visibleIf` (e.g. Label size ↔ Labels per A4 sheet), so
// the form reflows smoothly instead of jumping under the user's thumb.
const FIELD_PRESENCE = {
	initial: { opacity: 0, height: 0 },
	animate: { opacity: 1, height: 'auto' },
	exit: { opacity: 0, height: 0 },
	transition: { duration: 0.28, ease: EASE_OUT },
};

export function OptionsForm({ fields, config, advancedOpen, onAdvancedOpenChange, onChange, disabled }: OptionsFormProps) {
	const visible = visibleFields(fields, config, 'advanced');
	const primary = visible.filter((field) => field.simpleModeVisible);
	const advanced = visible.filter((field) => !field.simpleModeVisible);
	const activeAdvanced = advanced.filter((field) => config[field.id] !== field.default).length;
	const panelId = useId();

	// A field's paired up/down toggle (see `directionField`), only while that toggle's own `visibleIf` holds —
	// so "Original order" gets no direction button, since reversing it isn't what anyone means by sorting.
	const directionFor = (field: OptionField): DirectionToggleProps | undefined => {
		const paired = field.directionField ? fields.find((f) => f.id === field.directionField) : undefined;
		if (!paired || (paired.visibleIf && !paired.visibleIf(config))) return undefined;
		return {
			label: paired.label,
			choices: paired.choices ?? [],
			value: config[paired.id] === 'desc' ? 'desc' : 'asc',
			onChange: (value) => onChange(paired.id, value),
		};
	};

	return (
		<fieldset disabled={disabled} className={cn('min-w-0 transition-opacity', disabled && 'opacity-60')}>
			<div className="flex flex-col">
				<AnimatePresence initial={false}>
					{primary.map((field) => (
						<motion.div key={field.id} {...FIELD_PRESENCE} className="overflow-hidden">
							<div className="pb-6">
								<OptionFieldControl
									field={field}
									value={config[field.id]}
									onChange={(value) => onChange(field.id, value)}
									direction={directionFor(field)}
								/>
							</div>
						</motion.div>
					))}
				</AnimatePresence>
			</div>

			{advanced.length > 0 && (
				<div className="rounded-2xl border border-border bg-muted/30">
					<button
						type="button"
						onClick={() => onAdvancedOpenChange(!advancedOpen)}
						aria-expanded={advancedOpen}
						aria-controls={panelId}
						className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left"
					>
						<SlidersHorizontalIcon className="size-4 text-muted-foreground" />
						<span className="flex-1 text-sm font-semibold">More options</span>
						<AnimatePresence>
							{activeAdvanced > 0 && !advancedOpen && (
								<motion.span
									initial={{ opacity: 0, scale: 0.6 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.6 }}
									className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
								>
									{activeAdvanced} on
								</motion.span>
							)}
						</AnimatePresence>
						<motion.span animate={{ rotate: advancedOpen ? 180 : 0 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
							<ChevronDownIcon className="size-4 text-muted-foreground" />
						</motion.span>
					</button>
					<AnimatePresence initial={false}>
						{advancedOpen && (
							<motion.div id={panelId} {...FIELD_PRESENCE} className="overflow-hidden">
								<div className="space-y-1 px-2 pb-3">
									<AnimatePresence initial={false}>
										{advanced.map((field, index) => (
											<motion.div key={field.id} {...FIELD_PRESENCE} className="overflow-hidden">
												{/* A quiet heading wherever the group changes, so a long list still reads as a few short sets. */}
												{field.group && field.group !== advanced[index - 1]?.group && (
													<p className="px-2 pt-3 pb-0.5 text-[11px] font-medium tracking-wider text-muted-foreground/70 uppercase">
														{field.group}
													</p>
												)}
												<OptionFieldControl
													field={field}
													value={config[field.id]}
													onChange={(value) => onChange(field.id, value)}
													direction={directionFor(field)}
												/>
											</motion.div>
										))}
									</AnimatePresence>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			)}
		</fieldset>
	);
}

/* ---------------------------------------------------------------------------------------------------------- */

/** Mini sheet diagrams for the "labels per sheet" choices — a picture of the result reads faster than "2 labels". */
function SheetGlyph({ cells }: { cells: 1 | 2 | 4 }) {
	const rects =
		cells === 1
			? [{ x: 3, y: 3, w: 14, h: 20 }]
			: cells === 2
				? [
						{ x: 3, y: 3, w: 14, h: 9 },
						{ x: 3, y: 14, w: 14, h: 9 },
					]
				: [
						{ x: 3, y: 3, w: 6.5, h: 9 },
						{ x: 10.5, y: 3, w: 6.5, h: 9 },
						{ x: 3, y: 14, w: 6.5, h: 9 },
						{ x: 10.5, y: 14, w: 6.5, h: 9 },
					];
	return (
		<svg viewBox="0 0 20 26" className="h-6 w-5" fill="none" aria-hidden="true">
			<rect x="0.75" y="0.75" width="18.5" height="24.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
			{rects.map((r) => (
				<rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={r.h} rx="1" fill="currentColor" opacity="0.85" />
			))}
		</svg>
	);
}

const CHOICE_ICONS: Record<string, ReactNode> = {
	'label-printer': <TagIcon className="size-5" />,
	'a4-sheet': <FileTextIcon className="size-5" />,
	crop: <ScissorsIcon className="size-5" />,
	'full-page': <FileTextIcon className="size-5" />,
	'grid-1': <SheetGlyph cells={1} />,
	'grid-2': <SheetGlyph cells={2} />,
	'grid-4': <SheetGlyph cells={4} />,
	'sort-original': <ListOrderedIcon className="size-5" />,
	'sort-sku': <BarcodeIcon className="size-5" />,
	'sort-courier': <TruckIcon className="size-5" />,
	'sort-hub': <MapPinIcon className="size-5" />,
	'sort-color': <PaletteIcon className="size-5" />,
	'sort-size': <RulerIcon className="size-5" />,
};

function FieldHeader({ field, htmlFor }: { field: OptionField; htmlFor?: string }) {
	return (
		<div className="mb-2.5 space-y-0.5">
			{htmlFor ? (
				<label htmlFor={htmlFor} className="text-sm font-semibold">
					{field.label}
				</label>
			) : (
				<p className="text-sm font-semibold">{field.label}</p>
			)}
			{/* Inline rather than in a hover tooltip: phones have no hover, and this text is short enough to just show. */}
			{field.helpText && <p className="text-xs leading-relaxed text-muted-foreground">{field.helpText}</p>}
		</div>
	);
}

function OptionFieldControl({
	field,
	value,
	onChange,
	direction,
}: {
	field: OptionField;
	value: string | boolean;
	onChange: (value: string | boolean) => void;
	direction?: DirectionToggleProps;
}) {
	if (field.controlType === 'segmented' || field.controlType === 'radio') {
		const choices = field.choices ?? [];
		const asCards = choices.length > 0 && choices.every((choice) => choice.icon);
		return (
			<div role="radiogroup" aria-label={field.label}>
				<FieldHeader field={field} />
				{asCards ? (
					<ChoiceCards fieldId={field.id} choices={choices} value={value as string} onChange={onChange} />
				) : (
					<SegmentedPill fieldId={field.id} choices={choices} value={value as string} onChange={onChange} />
				)}
			</div>
		);
	}

	if (field.controlType === 'select') {
		return (
			<div>
				<FieldHeader field={field} />
				<div className="flex gap-2">
					<SelectRow label={field.label} choices={field.choices ?? []} value={value as string} onChange={onChange} />
					<AnimatePresence initial={false}>
						{direction && (
							<motion.div
								key="direction"
								initial={{ opacity: 0, width: 0, marginLeft: -8 }}
								animate={{ opacity: 1, width: 'auto', marginLeft: 0 }}
								exit={{ opacity: 0, width: 0, marginLeft: -8 }}
								transition={{ duration: 0.25, ease: EASE_OUT }}
								className="flex shrink-0 overflow-hidden"
							>
								<DirectionToggle {...direction} />
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		);
	}

	if (field.controlType === 'toggle') {
		const checked = value === true;
		return (
			// The whole row is the hit target (a `label` wrapping the switch), not just the 32px switch itself.
			<label
				className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-background/70"
			>
				<span className="min-w-0">
					<span className="block text-sm font-medium">{field.label}</span>
					{field.helpText && <span className="mt-0.5 block text-xs text-muted-foreground">{field.helpText}</span>}
				</span>
				<Switch checked={checked} onCheckedChange={(next) => onChange(Boolean(next))} />
			</label>
		);
	}

	return (
		<div className="px-2 pt-2 pb-1">
			<FieldHeader field={field} htmlFor={field.id} />
			<Input
				id={field.id}
				value={value as string}
				onChange={(e) => onChange(e.target.value)}
				maxLength={60}
				placeholder="e.g. Dispatch Monday"
				// 16px on phones stops iOS Safari zooming the page when the field is focused.
				className="h-12 rounded-xl bg-background text-base sm:text-sm"
			/>
		</div>
	);
}

function ChoiceCards({
	fieldId,
	choices,
	value,
	onChange,
}: {
	fieldId: string;
	choices: OptionChoice[];
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className={cn('grid gap-2.5', choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
			{choices.map((choice) => {
				const selected = choice.value === value;
				return (
					<motion.button
						key={choice.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(choice.value)}
						whileTap={{ scale: 0.96 }}
						transition={{ duration: 0.15 }}
						className={cn(
							'relative flex min-h-24 flex-col items-start gap-2 rounded-2xl border bg-card p-3 text-left transition-[border-color,box-shadow,background-color] duration-200',
							selected
								? 'border-primary bg-primary/[0.04] shadow-[inset_0_0_0_1px_var(--color-primary)]'
								: 'border-border hover:border-foreground/20',
						)}
					>
						<span
							className={cn(
								'flex size-9 items-center justify-center rounded-xl transition-colors duration-200',
								selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
							)}
						>
							{choice.icon ? CHOICE_ICONS[choice.icon] : null}
						</span>
						<span className="min-w-0">
							<span className="block text-sm leading-tight font-semibold">{choice.label}</span>
							{choice.description && (
								<span className="mt-0.5 block text-xs leading-tight text-muted-foreground">{choice.description}</span>
							)}
						</span>
						{/* A shared layoutId makes the check mark glide from the old card to the new one. */}
						{selected && (
							<motion.span
								layoutId={`${fieldId}-check`}
								transition={{ type: 'spring', stiffness: 500, damping: 35 }}
								className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
							>
								<CheckIcon className="size-3" strokeWidth={3} />
							</motion.span>
						)}
					</motion.button>
				);
			})}
		</div>
	);
}

/** Exported for the profit calculator, which uses the same pill for its own two-way choices. */
export function SegmentedPill({
	fieldId,
	choices,
	value,
	onChange,
	label,
}: {
	fieldId: string;
	choices: Pick<OptionChoice, 'value' | 'label'>[];
	value: string;
	onChange: (value: string) => void;
	/** Standalone uses need their own group label; inside the form the field header supplies it. */
	label?: string;
}) {
	return (
		<div className="flex rounded-2xl bg-muted p-1" {...(label ? { role: 'radiogroup', 'aria-label': label } : {})}>
			{choices.map((choice) => {
				const selected = choice.value === value;
				return (
					<button
						key={choice.value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => onChange(choice.value)}
						className={cn(
							'relative h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors duration-200',
							selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						{selected && (
							<motion.span
								layoutId={`${fieldId}-pill`}
								className="absolute inset-0 rounded-xl bg-background shadow-sm ring-1 ring-border/60"
								transition={{ type: 'spring', stiffness: 450, damping: 35 }}
							/>
						)}
						<span className="relative">{choice.label}</span>
					</button>
				);
			})}
		</div>
	);
}

/** A long list of choices as one compact row showing the current pick; tapping it opens the full list with
 * a one-line explanation under each option. Six chips took three rows on a phone and still didn't say what
 * each sort does. */
function SelectRow({
	label,
	choices,
	value,
	onChange,
}: {
	label: string;
	choices: OptionChoice[];
	value: string;
	onChange: (value: string) => void;
}) {
	const current = choices.find((choice) => choice.value === value) ?? choices[0];
	return (
		<Select value={value} onValueChange={(next) => next != null && onChange(String(next))}>
			<SelectTrigger
				aria-label={label}
				className="h-auto min-h-16 w-full min-w-0 flex-1 gap-3 rounded-2xl border-border bg-card py-2.5 pr-3 pl-2.5 text-left whitespace-normal transition-[border-color,background-color] hover:border-foreground/20 data-popup-open:border-primary [&>svg:last-child]:hidden"
			>
				<ChoiceIcon icon={current?.icon} selected />
				<span className="min-w-0 flex-1">
					<motion.span key={current?.value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="block">
						<span className="block text-sm font-semibold">{current?.label}</span>
						{current?.description && (
							<span className="mt-0.5 block text-xs text-muted-foreground">{current.description}</span>
						)}
					</motion.span>
				</span>
				<ChevronsUpDownIcon className="size-4 text-muted-foreground" />
			</SelectTrigger>
			<SelectContent alignItemWithTrigger={false} sideOffset={6} className="rounded-2xl p-1.5 shadow-xl">
				{choices.map((choice) => (
					<SelectItem
						key={choice.value}
						value={choice.value}
						className="min-h-14 cursor-pointer gap-3 rounded-xl py-2 pr-10 pl-2 data-selected:bg-primary/[0.06] [&_svg]:size-4"
					>
						<ChoiceIcon icon={choice.icon} selected={choice.value === value} />
						<span className="min-w-0">
							<span className="block text-sm font-semibold">{choice.label}</span>
							{choice.description && (
								<span className="block text-xs font-normal whitespace-normal text-muted-foreground">{choice.description}</span>
							)}
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

interface DirectionToggleProps {
	label: string;
	choices: OptionChoice[];
	value: 'asc' | 'desc';
	onChange: (value: 'asc' | 'desc') => void;
}

/** Square up/down button beside a sort select — same pattern as the P&L products sort. */
function DirectionToggle({ label, choices, value, onChange }: DirectionToggleProps) {
	const current = choices.find((choice) => choice.value === value)?.label ?? value;
	return (
		<button
			type="button"
			onClick={() => onChange(value === 'asc' ? 'desc' : 'asc')}
			title={current}
			aria-label={`${label}: ${current}. Activate to reverse.`}
			className={cn(
				'flex w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground',
				'transition-colors hover:border-foreground/20 hover:text-foreground',
				'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
			)}
		>
			<AnimatePresence mode="wait" initial={false}>
				<motion.span
					key={value}
					initial={{ opacity: 0, y: value === 'desc' ? -6 : 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: value === 'desc' ? 6 : -6 }}
					transition={{ duration: 0.15, ease: EASE_OUT }}
					className="flex flex-col items-center gap-0.5"
				>
					{value === 'desc' ? (
						<ArrowDownIcon className="size-5" aria-hidden="true" />
					) : (
						<ArrowUpIcon className="size-5" aria-hidden="true" />
					)}
					{/* A bare arrow doesn't say what it orders by; the caption does. */}
					<span className="text-[11px] leading-none font-semibold" aria-hidden="true">
						{value === 'desc' ? 'Z–A' : 'A–Z'}
					</span>
				</motion.span>
			</AnimatePresence>
		</button>
	);
}

function ChoiceIcon({ icon, selected }: { icon?: string; selected: boolean }) {
	if (!icon) return null;
	return (
		<span
			className={cn(
				'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 [&_svg]:size-5!',
				selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
			)}
		>
			{CHOICE_ICONS[icon]}
		</span>
	);
}
