/*
 * Unlocking with the device's biometrics (fingerprint, face, or the device screen lock) through
 * WebAuthn and its `prf` extension: the authenticator derives a secret that only comes out after
 * the user verification. That secret wraps the data key, exactly as the PIN-derived key does.
 * Without PRF support (older browsers) the option is not offered: a WebAuthn prompt that does not
 * produce a key would only be a gate in front of a key stored in clear text.
 */

export class BiometricUnsupportedError extends Error {
  constructor() {
    super('This device cannot derive a key from biometrics');
    this.name = 'BiometricUnsupportedError';
  }
}

interface PrfExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

const random = (length: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(length));

/** True if the browser has a user-verifying platform authenticator (a PRF check needs the real prompt). */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== 'undefined'
      && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

function secretOf(credential: PublicKeyCredential | null): Uint8Array | null {
  const first = (credential?.getClientExtensionResults() as PrfExtensionResults | undefined)?.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

/** Asks the authenticator for the secret of an enrolled credential (one user verification prompt). */
export async function getBiometricSecret(credentialId: Uint8Array<ArrayBuffer>, prfSalt: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const options = {
    challenge: random(32),
    allowCredentials: [{ type: 'public-key', id: credentialId }],
    userVerification: 'required',
    timeout: 60_000,
    extensions: { prf: { eval: { first: prfSalt } } },
  };
  const credential = (await navigator.credentials.get({ publicKey: options as unknown as PublicKeyCredentialRequestOptions })) as PublicKeyCredential | null;
  const secret = secretOf(credential);
  if (!secret) throw new BiometricUnsupportedError();
  return secret;
}

/** Creates the credential (one prompt) then reads its secret (a second one on most platforms). */
export async function enrollBiometric(
  appName: string,
  prfSalt: Uint8Array<ArrayBuffer>,
): Promise<{ credentialId: Uint8Array<ArrayBuffer>; secret: Uint8Array }> {
  const options = {
    rp: { name: appName },
    user: { id: random(16), name: appName, displayName: appName },
    challenge: random(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60_000,
    extensions: { prf: { eval: { first: prfSalt } } },
  };
  const credential = (await navigator.credentials.create({ publicKey: options as unknown as PublicKeyCredentialCreationOptions })) as PublicKeyCredential | null;
  if (!credential) throw new BiometricUnsupportedError();
  const results = credential.getClientExtensionResults() as PrfExtensionResults;
  if (results.prf?.enabled === false) throw new BiometricUnsupportedError();
  const credentialId = new Uint8Array(credential.rawId);
  const secret = secretOf(credential) ?? (await getBiometricSecret(credentialId, prfSalt));
  return { credentialId, secret };
}
