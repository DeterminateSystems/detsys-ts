import { Result as Result$1, Ok, Err } from 'ts-results';

type AnonymizedCorrelationHashes = {
    correlation_source: string;
    repository?: string;
    run?: string;
    run_differentiator?: string;
    workflow?: string;
    groups: Record<string, string | undefined>;
};

/**
 * An algebraic return type directly inspired by Rust's `Result`.
 */
type Result<T> = Result$1<T, string>;
/**
 * Convert a `Result<T>` into a `T` (if okay) or fail the Action (if error).
 */
declare function valueOrFail<T>(res: Result<T>): T;
/**
 * Coerce an error into a string.
 */
declare function coerceErrorToString(e: unknown): string;
/**
 * If the supplied hook function returns an error, fail the Action with the
 * error message supplied by the callback.
 */
declare function failOnError<T>(callback: Promise<Result<T>>): Promise<void>;
/**
 * A useful constant for declaring success as an `Ok<string>`.
 */
declare const SUCCESS: Ok<string>;

declare const result_Err: typeof Err;
declare const result_Ok: typeof Ok;
type result_Result<T> = Result<T>;
declare const result_SUCCESS: typeof SUCCESS;
declare const result_coerceErrorToString: typeof coerceErrorToString;
declare const result_failOnError: typeof failOnError;
declare const result_valueOrFail: typeof valueOrFail;
declare namespace result {
  export { result_Err as Err, result_Ok as Ok, type result_Result as Result, result_SUCCESS as SUCCESS, result_coerceErrorToString as coerceErrorToString, result_failOnError as failOnError, result_valueOrFail as valueOrFail };
}

/**
 * Get a Boolean input from the Action's configuration by name.
 */
declare const getBool: (name: string) => boolean;
/**
 * The character used to separate values in the input string.
 */
type Separator = "space" | "comma";
/**
 * Convert a comma-separated string input into an array of strings. If `comma` is selected,
 * all whitespace is removed from the string before converting to an array.
 */
declare const getArrayOfStrings: (name: string, separator: Separator) => string[];
declare const handleString: (input: string, separator: Separator) => string[];
/**
 * Get a multi-line string input from the Action's configuration by name or return `null` if not set.
 */
declare const getMultilineStringOrNull: (name: string) => string[] | null;
/**
 * Get a number input from the Action's configuration by name or return `null` if not set.
 */
declare const getNumberOrNull: (name: string) => number | null;
/**
 * Get a string input from the Action's configuration.
 */
declare const getString: (name: string) => string;
/**
 * Get a string input from the Action's configuration by name or return `null` if not set.
 */
declare const getStringOrNull: (name: string) => string | null;
/**
 * Get a string input from the Action's configuration by name or return `undefined` if not set.
 */
declare const getStringOrUndefined: (name: string) => string | undefined;

type inputs_Separator = Separator;
declare const inputs_getArrayOfStrings: typeof getArrayOfStrings;
declare const inputs_getBool: typeof getBool;
declare const inputs_getMultilineStringOrNull: typeof getMultilineStringOrNull;
declare const inputs_getNumberOrNull: typeof getNumberOrNull;
declare const inputs_getString: typeof getString;
declare const inputs_getStringOrNull: typeof getStringOrNull;
declare const inputs_getStringOrUndefined: typeof getStringOrUndefined;
declare const inputs_handleString: typeof handleString;
declare namespace inputs {
  export { type inputs_Separator as Separator, inputs_getArrayOfStrings as getArrayOfStrings, inputs_getBool as getBool, inputs_getMultilineStringOrNull as getMultilineStringOrNull, inputs_getNumberOrNull as getNumberOrNull, inputs_getString as getString, inputs_getStringOrNull as getStringOrNull, inputs_getStringOrUndefined as getStringOrUndefined, inputs_handleString as handleString };
}

/**
 * @packageDocumentation
 * Helpers for determining system attributes of the current runner.
 */

/**
 * Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
 */
declare function getArchOs(): Result<string>;
/**
 * Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
 */
declare function getNixPlatform(archOs: string): Result<string>;

declare const platform_getArchOs: typeof getArchOs;
declare const platform_getNixPlatform: typeof getNixPlatform;
declare namespace platform {
  export { platform_getArchOs as getArchOs, platform_getNixPlatform as getNixPlatform };
}

type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
type ExecutionPhase = "main" | "post";
type NixRequirementHandling = "fail" | "warn" | "ignore";
/**
 * The options passed to the Action.
 */
type ActionOptions = {
    /**
     * Name of the project generally, and the name of the binary on disk.
     */
    name: string;
    /**
     * Defaults to `name` and corresponds to the `ProjectHost` entry on i.d.s.
     */
    idsProjectName?: string;
    /**
     * Defaults to `action:`
     */
    eventPrefix?: string;
    /**
     * The "architecture" URL component expected by i.d.s. for the `ProjectHost`.
     */
    fetchStyle: FetchSuffixStyle;
    /**
     * IdsToolbox assumes the GitHub Action exposes source overrides, like branch/pr/etc. to be named `source-*`.
     * This prefix adds a fallback name, prefixed by `${legacySourcePrefix}-`.
     * Users who configure legacySourcePrefix will get warnings asking them to change to `source-*`.
     */
    legacySourcePrefix?: string;
    /**
     * Check if Nix is installed before running this action.
     * If Nix isn't installed, this action will not fail, and will instead do nothing.
     * The action will emit a user-visible warning instructing them to install Nix.
     */
    requireNix: NixRequirementHandling;
    /**
     * The URL to send diagnostics events to.
     * Specifically:
     *   * `undefined` -> Attempt to read the `diagnostic-enpdoint` action input, and calculate the default diagnostics URL for IDS from there.
     *   * `null` -> Disable sending diagnostics altogether.
     *   * URL(...) -> Send diagnostics to this other URL instead
     */
    diagnosticsUrl?: URL | null;
    /**
     * The main logic of the Action.
     */
    hookMain: () => Promise<Result<string>>;
    /**
     * The post logic of the Action.
     */
    hookPost?: () => Promise<Result<string>>;
};
declare class IdsToolbox {
    private identity;
    private actionOptions;
    private archOs;
    private nixSystem;
    private architectureFetchSuffix;
    private executionPhase;
    private sourceParameters;
    private facts;
    private exceptionAttachments;
    private events;
    private client;
    /**
     * The preferred instantiator for `IdsToolbox`. Unless using standard
     * `new IdsToolbox(...)`, this instantiator returns a `Result` rather than
     * throwing an `Error`.
     */
    static create(actionOptions: ActionOptions): Result<IdsToolbox>;
    /**
     * The standard constructor for `IdsToolbox`. Use `create` instead.
     */
    constructor(actionOptions: ActionOptions);
    /**
     * Attach a file to the diagnostics data in error conditions.
     *
     * The file at `location` doesn't need to exist when stapleFile is called.
     *
     * If the file doesn't exist or is unreadable when trying to staple the attachments, the JS error will be stored in a context value at `staple_failure_{name}`.
     * If the file is readable, the file's contents will be stored in a context value at `staple_value_{name}`.
     */
    stapleFile(name: string, location: string): void;
    execute(): void;
    private stringifyError;
    private executeAsync;
    addFact(key: string, value: string | boolean): void;
    getDiagnosticsUrl(): URL | undefined;
    getUniqueId(): string;
    getCorrelationHashes(): AnonymizedCorrelationHashes;
    recordEvent(eventName: string, context?: Record<string, unknown>): void;
    fetch(): Promise<string>;
    fetchExecutable(): Promise<string>;
    private complete;
    private getUrl;
    private cacheKey;
    private getCachedVersion;
    private saveCachedVersion;
    private preflightRequireNix;
    private submitEvents;
    getTemporaryName(): string;
}

export { type ActionOptions, type ExecutionPhase, type FetchSuffixStyle, IdsToolbox, type NixRequirementHandling, inputs, platform, result };
