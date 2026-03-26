import chalk from "chalk";

/**
 * Forest palette for os-eco branding.
 */
export const brand = chalk.rgb(124, 179, 66);
export const accent = chalk.rgb(255, 183, 77);
export const muted = chalk.rgb(120, 120, 110);

let _quiet = false;

/**
 * Set the quiet mode globally.
 */
export function setQuiet(v: boolean): void {
	_quiet = v;
}

/**
 * Print a success message with the brand checkmark.
 */
export function printSuccess(msg: string): void {
	if (_quiet) return;
	console.log(`${brand("✓")} ${brand(msg)}`);
}

/**
 * Print an error message with the red cross.
 */
export function printError(msg: string): void {
	console.error(`${chalk.red("✗")} ${msg}`);
}

/**
 * Print a warning message with the yellow exclamation.
 */
export function printWarning(msg: string): void {
	console.log(`${chalk.yellow("!")} ${msg}`);
}

/**
 * Print a mutation confirmation message, respecting --quiet.
 * Used for basic confirmations that don't need the full success style.
 */
export function printConfirm(message: string): void {
	if (!_quiet) console.log(message);
}
