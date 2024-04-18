/**
 * @packageDocumentation
 * Determinate Systems' TypeScript library for creating GitHub Actions logic.
 */
import * as correlation from "./correlation.js";
export type FetchSuffixStyle = "nix-style" | "gh-env-style" | "universal";
export type ExecutionPhase = "main" | "post";
export type NixRequirementHandling = "fail" | "warn" | "ignore";
export type ActionOptions = {
    name: string;
    idsProjectName?: string;
    eventPrefix?: string;
    fetchStyle: FetchSuffixStyle;
    legacySourcePrefix?: string;
    requireNix: NixRequirementHandling;
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
    private hookMain?;
    private hookPost?;
    constructor(actionOptions: ActionOptions);
    onMain(callback: () => Promise<void>): void;
    onPost(callback: () => Promise<void>): void;
    execute(): void;
    private executeAsync;
    addFact(key: string, value: string | boolean): void;
    getDiagnosticsUrl(): URL | undefined;
    getUniqueId(): string;
    getCorrelationHashes(): correlation.AnonymizedCorrelationHashes;
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
    private getTemporaryName;
}
export * as inputs from "./inputs.js";
export * as platform from "./platform.js";
