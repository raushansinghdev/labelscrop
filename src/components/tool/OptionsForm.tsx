import { InfoIcon } from 'lucide-react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type OptionConfig, type OptionField, visibleFields } from '@/lib/options/schema';

interface OptionsFormProps {
	fields: OptionField[];
	config: OptionConfig;
	mode: 'simple' | 'advanced';
	onChange: (id: string, value: string | boolean) => void;
}

export function OptionsForm({ fields, config, mode, onChange }: OptionsFormProps) {
	const visible = visibleFields(fields, config, mode);
	const groupOrder: string[] = [];
	const groups = new Map<string, OptionField[]>();
	for (const field of visible) {
		const key = field.group ?? '';
		if (!groups.has(key)) {
			groups.set(key, []);
			groupOrder.push(key);
		}
		groups.get(key)?.push(field);
	}

	return (
		<div className="space-y-6">
			{groupOrder.map((group) => (
				<div key={group || 'ungrouped'}>
					{group && (
						<h3 className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</h3>
					)}
					<div className="space-y-4">
						{groups.get(group)?.map((field) => (
							<OptionFieldControl
								key={field.id}
								field={field}
								value={config[field.id]}
								onChange={(value) => onChange(field.id, value)}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function FieldLabel({ field }: { field: OptionField }) {
	return (
		<div className="flex items-center gap-1.5">
			<Label htmlFor={field.id}>{field.label}</Label>
			{field.helpText && (
				<Tooltip>
					<TooltipTrigger aria-label={`About ${field.label}`} className="text-muted-foreground hover:text-foreground">
						<InfoIcon className="size-3.5" />
					</TooltipTrigger>
					<TooltipContent>{field.helpText}</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}

function OptionFieldControl({
	field,
	value,
	onChange,
}: {
	field: OptionField;
	value: string | boolean;
	onChange: (value: string | boolean) => void;
}) {
	if (field.controlType === 'segmented') {
		return (
			<div className="flex flex-col gap-1.5">
				<FieldLabel field={field} />
				<div className="inline-flex w-fit rounded-lg border border-border bg-muted p-1" role="group" aria-label={field.label}>
					{field.choices?.map((choice) => (
						<button
							key={choice.value}
							type="button"
							aria-pressed={value === choice.value}
							onClick={() => onChange(choice.value)}
							className={cn(
								'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
								value === choice.value
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground',
							)}
						>
							{choice.label}
						</button>
					))}
				</div>
			</div>
		);
	}

	if (field.controlType === 'select') {
		return (
			<div className="flex flex-col gap-1.5">
				<FieldLabel field={field} />
				{/* `items` is what makes the trigger show the choice's label ("SKU ID") rather than the raw stored
				 * value ("sku") — Base UI's Select.Value falls back to the value when it has no item map. */}
				<Select items={field.choices} value={value as string} onValueChange={(v) => onChange(v as string)}>
					<SelectTrigger id={field.id} className="h-10 w-full shadow-xs sm:w-72">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{field.choices?.map((choice) => (
							<SelectItem key={choice.value} value={choice.value}>
								{choice.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	}

	if (field.controlType === 'radio') {
		return (
			<div className="flex flex-col gap-1.5">
				<FieldLabel field={field} />
				<RadioGroup value={value as string} onValueChange={(v) => onChange(v as string)}>
					{field.choices?.map((choice) => (
						<label key={choice.value} className="flex items-center gap-2 text-sm">
							<RadioGroupItem value={choice.value} />
							{choice.label}
						</label>
					))}
				</RadioGroup>
			</div>
		);
	}

	if (field.controlType === 'toggle') {
		return (
			<div className="flex items-center justify-between gap-4">
				<FieldLabel field={field} />
				<Switch id={field.id} checked={value as boolean} onCheckedChange={(checked) => onChange(Boolean(checked))} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-1.5">
			<FieldLabel field={field} />
			<Input
				id={field.id}
				value={value as string}
				onChange={(e) => onChange(e.target.value)}
				maxLength={60}
				placeholder="e.g. Dispatch Monday"
				className="w-full sm:w-72"
			/>
		</div>
	);
}
