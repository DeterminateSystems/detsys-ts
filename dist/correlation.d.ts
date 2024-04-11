export type AnonymizedCorrelationHashes = {
    correlation_source: string;
    repository?: string;
    run?: string;
    run_differentiator?: string;
    workflow?: string;
    groups: Record<string, string | undefined>;
};
export declare function identify(projectName: string): AnonymizedCorrelationHashes;
