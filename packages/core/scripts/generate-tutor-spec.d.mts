/** Types for `generate-tutor-spec.mjs` (used by the sync test). */
export declare const CORE_DIR: string;
export declare const SPEC_DIR: string;
export declare const OUTPUT: string;
/** The generated module's source, formatted. */
export declare function renderGenerated(): Promise<string>;
/** Whether the committed module matches the spec. */
export declare function isCurrent(): Promise<boolean>;
