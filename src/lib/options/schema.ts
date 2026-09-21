export type OptionControlType = 'segmented' | 'select' | 'toggle' | 'text' | 'radio';

export interface OptionChoice {
	value: string;
	label: string;
	/** Short secondary line shown under the label when the choice renders as a card (e.g. "Label + invoice"). */
	description?: string;
	/** Names a glyph from the UI's small icon registry (see `OptionsForm.tsx`). A segmented field whose choices
	 * all carry an icon renders as tappable cards instead of a compact pill switcher. */
	icon?: string;
}

/** A config value keyed by option id. Values are always strings/booleans at this layer — a platform's
 * options.ts is responsible for mapping them onto the concrete types the engine actually wants (e.g.
 * `labelSize: 'thermal-4x6'` maps onto a `LayoutPreset` lookup). */
export type OptionConfig = Record<string, string | boolean>;

/** One entry in a platform's declarative options list. The UI layer needs exactly one generic
 * `<OptionsForm />` component keyed off `controlType` to render any platform's option set — adding, removing,
 * or reordering options for a platform is then just editing its `options.ts` array, no UI rework. */
export interface OptionField {
	id: string;
	label: string;
	helpText?: string;
	/** Groups related fields under one heading in the rendered form (e.g. "Printer", "Sorting"). */
	group?: string;
	controlType: OptionControlType;
	/** Required for 'segmented' | 'select' | 'radio'; ignored for 'toggle' | 'text'. */
	choices?: OptionChoice[];
	default: string | boolean;
	/** Cross-option dependencies as data rather than scattered component conditionals — e.g. "Label Size"
	 * is only shown when `config.printerType === 'label'`. */
	visibleIf?: (config: OptionConfig) => boolean;
	/** Id of a two-choice `'asc' | 'desc'` field rendered as an up/down toggle beside this select, instead of
	 * as a control of its own (e.g. sort key + sort order). */
	directionField?: string;
	/** Set on a field that another field renders inside its own control (see `directionField`), so the form
	 * doesn't also render it standalone. */
	renderedByParent?: boolean;
	/** Whether this field appears in "Simple" mode, or only in "Advanced" mode. */
	simpleModeVisible: boolean;
}

/** Resolves a config value for every field, applying defaults for anything missing (e.g. on first visit,
 * or after a schema change invalidated a saved localStorage value). */
export function resolveDefaultConfig(fields: OptionField[]): OptionConfig {
	const config: OptionConfig = {};
	for (const field of fields) {
		config[field.id] = field.default;
	}
	return config;
}

/** Fields visible for the given mode, honoring `visibleIf` dependencies against the current config. */
export function visibleFields(
	fields: OptionField[],
	config: OptionConfig,
	mode: 'simple' | 'advanced',
): OptionField[] {
	return fields.filter((field) => {
		if (field.renderedByParent) return false;
		if (mode === 'simple' && !field.simpleModeVisible) return false;
		if (field.visibleIf && !field.visibleIf(config)) return false;
		return true;
	});
}

/** Keeps only the saved values that still fit the current field list: known ids, the same value type as the
 * field's default, and — for choice fields — a value that's still one of the choices. A field that changed
 * shape between releases (e.g. a Yes/No segmented control that became a toggle) then falls back to its
 * default instead of feeding a stale string into a boolean control. */
export function sanitizeConfig(fields: OptionField[], saved: OptionConfig): OptionConfig {
	const clean: OptionConfig = {};
	for (const field of fields) {
		const value = saved[field.id];
		if (value === undefined || typeof value !== typeof field.default) continue;
		if (field.choices && !field.choices.some((choice) => choice.value === value)) continue;
		clean[field.id] = value;
	}
	return clean;
}
