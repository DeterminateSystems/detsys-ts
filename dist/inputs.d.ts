/**
 * Get a Boolean input from the Action's configuration by name.
 *
 * @param name
 * @returns boolean
 */
declare const getBool: (name: string) => boolean;
/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 *
 * @param name
 * @returns string[] | null
 */
declare const getMultilineStringOrNull: (name: string) => string[] | null;
/**
 * Get a number input from the Action's configuration by name or return `null` if not set.
 *
 * @param name
 * @returns number | null
 */
declare const getNumberOrNull: (name: string) => number | null;
/**
 * Get a string input from the Action's configuration.
 *
 * @param name
 * @returns string
 */
declare const getString: (name: string) => string;
/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 *
 * @param name
 * @returns string | null
 */
declare const getStringOrNull: (name: string) => string | null;
/**
 * Get a string input from the Action's configuration by name or return `undefined` if not set.
 *
 * @param name
 * @returns string | undefined
 */
declare const getStringOrUndefined: (name: string) => string | undefined;
export { getBool, getMultilineStringOrNull, getNumberOrNull, getString, getStringOrNull, getStringOrUndefined, };
