import * as correlation from "./correlation.js";
export type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
export type ExecutionPhase = "main" | "post";
export type ActionOptions = {
    name: string;
    idsProjectName?: string;
    eventPrefix?: string;
    fetchStyle: FetchSuffixStyle;
    legacySourcePrefix?: string;
    diagnosticsUrl?: URL | null;
};
export declare class IdsToolbox {
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
    getCorrelationHashes(): correlation.AnonymizedCorrelationHashes;
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
