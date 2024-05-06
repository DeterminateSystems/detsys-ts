type AnonymizedCorrelationHashes = {
    correlation_source: string;
    repository?: string;
    run?: string;
    run_differentiator?: string;
    workflow?: string;
    groups: Record<string, string | undefined>;
};

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
 * Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
 */
declare function getArchOs(): string;
/**
 * Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
 */
declare function getNixPlatform(archOs: string): string;

declare const platform_getArchOs: typeof getArchOs;
declare const platform_getNixPlatform: typeof getNixPlatform;
declare namespace platform {
  export { platform_getArchOs as getArchOs, platform_getNixPlatform as getNixPlatform };
}

type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
type ExecutionPhase = "main" | "post";
type NixRequirementHandling = "fail" | "warn" | "ignore";
type ActionOptions = {
    name: string;
    idsProjectName?: string;
    eventPrefix?: string;
    fetchStyle: FetchSuffixStyle;
    legacySourcePrefix?: string;
    requireNix: NixRequirementHandling;
    diagnosticsUrl?: URL | null;
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
    private hookMain?;
    private hookPost?;
    constructor(actionOptions: ActionOptions);
    stapleFile(name: string, location: string): void;
    onMain(callback: () => Promise<void>): void;
    onPost(callback: () => Promise<void>): void;
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

export { type ActionOptions, type ExecutionPhase, type FetchSuffixStyle, IdsToolbox, type NixRequirementHandling, inputs, platform };
