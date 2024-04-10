type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
type ExecutionPhase = "main" | "post";
type ActionOptions = {
    name: string;
    idsProjectName?: string;
    eventPrefix?: string;
    fetchStyle: FetchSuffixStyle;
    legacySourcePrefix?: string;
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
    private events;
    private client;
    constructor(actionOptions: ActionOptions);
    addFact(key: string, value: string | boolean): void;
    getDiagnosticsUrl(): URL | undefined;
    getUniqueId(): string;
    recordEvent(eventName: string, context?: Record<string, unknown>): void;
    fetch(): Promise<string>;
    fetchExecutable(): Promise<string>;
    complete(): Promise<void>;
    private getUrl;
    private cacheKey;
    private getCachedVersion;
    private saveCachedVersion;
    private submitEvents;
    private getTemporaryName;
}

export { type ActionOptions, type ExecutionPhase, type FetchSuffixStyle, IdsToolbox };
