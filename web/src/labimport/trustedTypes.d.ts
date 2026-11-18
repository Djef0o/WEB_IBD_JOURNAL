/** Minimal Trusted Types declarations (not yet part of the DOM lib). */
interface TrustedScriptURL {
  toString(): string;
}
interface TrustedTypePolicy {
  createScriptURL(input: string): TrustedScriptURL;
}
interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: { createScriptURL?: (input: string) => string },
  ): TrustedTypePolicy;
}
