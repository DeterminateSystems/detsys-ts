import { Got } from 'got';

type Feature = {
    variant: boolean | string;
    payload?: string;
};

type AnonymizedCorrelationHashes = {
    correlation_source: string;
    repository?: string;
    run?: string;
    run_differentiator?: string;
    workflow?: string;
    groups: Record<string, string | undefined>;
};

/**
 * Coerce a value of type `unknown` into a string.
 */
declare function stringifyError(e: unknown): string;

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
/**
 * Convert a string input into an array of strings or `null` if no value is set.
 */
declare const getArrayOfStringsOrNull: (name: string, separator: Separator) => string[] | null;
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
declare const inputs_getArrayOfStringsOrNull: typeof getArrayOfStringsOrNull;
declare const inputs_getBool: typeof getBool;
declare const inputs_getMultilineStringOrNull: typeof getMultilineStringOrNull;
declare const inputs_getNumberOrNull: typeof getNumberOrNull;
declare const inputs_getString: typeof getString;
declare const inputs_getStringOrNull: typeof getStringOrNull;
declare const inputs_getStringOrUndefined: typeof getStringOrUndefined;
declare const inputs_handleString: typeof handleString;
declare namespace inputs {
  export { type inputs_Separator as Separator, inputs_getArrayOfStrings as getArrayOfStrings, inputs_getArrayOfStringsOrNull as getArrayOfStringsOrNull, inputs_getBool as getBool, inputs_getMultilineStringOrNull as getMultilineStringOrNull, inputs_getNumberOrNull as getNumberOrNull, inputs_getString as getString, inputs_getStringOrNull as getStringOrNull, inputs_getStringOrUndefined as getStringOrUndefined, inputs_handleString as handleString };
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

/**
 * An enum for describing different "fetch suffixes" for i.d.s.
 *
 * - `nix-style` means that system names like `x86_64-linux` and `aarch64-darwin` are used
 * - `gh-env-style` means that names like `X64-Linux` and `ARM64-macOS` are used
 * - `universal` means that the suffix is the static `universal` (for non-system-specific things)
 */
type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
/**
 * GitHub Actions has two possible execution phases: `main` and `post`.
 */
type ExecutionPhase = "main" | "post";
/**
 * How to handle whether Nix is currently installed on the runner.
 *
 * - `fail` means that the workflow fails if Nix isn't installed
 * - `warn` means that a warning is logged if Nix isn't installed
 * - `ignore` means that Nix will not be checked
 */
type NixRequirementHandling = "fail" | "warn" | "ignore";
/**
 * Whether the Nix store on the runner is trusted.
 *
 * - `trusted` means yes
 * - `untrusted` means no
 * - `unknown` means that the status couldn't be determined
 *
 * This is determined via the output of `nix store info --json`.
 */
type NixStoreTrust = "trusted" | "untrusted" | "unknown";
type ActionOptions = {
    name: string;
    idsProjectName?: string;
    eventPrefix?: string;
    fetchStyle: FetchSuffixStyle;
    legacySourcePrefix?: string;
    requireNix: NixRequirementHandling;
    diagnosticsSuffix?: string;
};
declare abstract class DetSysAction {
    nixStoreTrust: NixStoreTrust;
    strictMode: boolean;
    private actionOptions;
    private exceptionAttachments;
    private archOs;
    private executionPhase;
    private nixSystem;
    private architectureFetchSuffix;
    private sourceParameters;
    private facts;
    private events;
    private identity;
    private idsHost;
    private features;
    private featureEventMetadata;
    private determineExecutionPhase;
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
    /**
     * The main execution phase.
     */
    abstract main(): Promise<void>;
    /**
     * The post execution phase.
     */
    abstract post(): Promise<void>;
    /**
     * Execute the Action as defined.
     */
    execute(): void;
    getTemporaryName(): string;
    addFact(key: string, value: string | boolean): void;
    getDiagnosticsUrl(): Promise<URL | undefined>;
    getUniqueId(): string;
    getCorrelationHashes(): AnonymizedCorrelationHashes;
    recordEvent(eventName: string, context?: Record<string, unknown>): void;
    /**
     * Unpacks the closure returned by `fetchArtifact()`, imports the
     * contents into the Nix store, and returns the path of the executable at
     * `/nix/store/STORE_PATH/bin/${bin}`.
     */
    unpackClosure(bin: string): Promise<string>;
    /**
     * Fetches the executable at the URL determined by the `source-*` inputs and
     * other facts, `chmod`s it, and returns the path to the executable on disk.
     */
    fetchExecutable(): Promise<string>;
    private get isMain();
    private get isPost();
    private executeAsync;
    getClient(): Promise<Got>;
    private checkIn;
    getFeature(name: string): Feature | undefined;
    /**
     * Check in to install.determinate.systems, to accomplish three things:
     *
     * 1. Preflight the server selected from IdsHost, to increase the chances of success.
     * 2. Fetch any incidents and maintenance events to let users know in case things are weird.
     * 3. Get feature flag data so we can gently roll out new features.
     */
    private requestCheckIn;
    /**
     * Fetch an artifact, such as a tarball, from the location determined by the
     * `source-*` inputs. If `source-binary` is specified, this will return a path
     * to a binary on disk; otherwise, the artifact will be downloaded from the
     * URL determined by the other `source-*` inputs (`source-url`, `source-pr`,
     * etc.).
     */
    private fetchArtifact;
    /**
     * A helper function for failing on error only if strict mode is enabled.
     * This is intended only for CI environments testing Actions themselves.
     */
    failOnError(msg: string): void;
    private complete;
    private getCheckInUrl;
    private getSourceUrl;
    private cacheKey;
    private getCachedVersion;
    private saveCachedVersion;
    private preflightRequireNix;
    private preflightNixStoreInfo;
    private submitEvents;
}

export { type ActionOptions, DetSysAction, type ExecutionPhase, type FetchSuffixStyle, type NixRequirementHandling, type NixStoreTrust, inputs, platform, stringifyError };
