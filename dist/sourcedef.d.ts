export type SourceDef = {
    path?: string;
    url?: string;
    tag?: string;
    pr?: string;
    branch?: string;
    revision?: string;
};
export declare function constructSourceParameters(legacyPrefix?: string): SourceDef;
