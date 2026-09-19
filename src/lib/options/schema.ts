export type OptionControlType = 'segmented' | 'select' | 'toggle' | 'text' | 'radio';

export interface OptionChoice {
	value: string;
	label: string;
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
		if (mode === 'simple' && !field.simpleModeVisible) return false;
		if (field.visibleIf && !field.visibleIf(config)) return false;
		return true;
	});
}
