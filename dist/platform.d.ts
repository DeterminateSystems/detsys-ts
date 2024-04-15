/**
 * Get the current architecture plus OS. Examples include `X64-Linux` and `ARM64-macOS`.
 */
export declare function getArchOs(): string;
/**
 * Get the current Nix system. Examples include `x86_64-linux` and `aarch64-darwin`.
 */
export declare function getNixPlatform(archOs: string): string;
