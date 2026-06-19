/**
 * A minimal software WebAuthn authenticator for tests. It produces valid
 * `none`-attestation registration responses and assertion responses that
 * @simplewebauthn/server can verify, using an in-process ES256 (P-256) key.
 *
 * This lets us prove a real passkey register -> login round-trip without a
 * browser or hardware authenticator. Not for production use.
 */
import { webcrypto } from "node:crypto";
import { isoBase64URL, cose } from "@simplewebauthn/server/helpers";

const subtle = webcrypto.subtle;

// All byte buffers in this helper are explicitly ArrayBuffer-backed so they
// satisfy @simplewebauthn's `Uint8Array_` (= Uint8Array<ArrayBuffer>) bound.
type U8 = Uint8Array<ArrayBuffer>;

/** Copy any view into a fresh ArrayBuffer-backed Uint8Array. */
function u8(src: ArrayLike<number> | ArrayBufferLike): U8 {
  const view =
    src instanceof ArrayBuffer || src instanceof SharedArrayBuffer
      ? new Uint8Array(src)
      : (src as ArrayLike<number>);
  const out = new Uint8Array(view.length) as U8;
  out.set(view);
  return out;
}

function concat(...parts: Uint8Array[]): U8 {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total) as U8;
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function sha256(data: Uint8Array): Promise<U8> {
  return u8(await subtle.digest("SHA-256", data));
}

/** CBOR-encode a positive integer (used for map sizes / small ints). */
function cborUint(n: number): Uint8Array {
  if (n < 24) return new Uint8Array([n]);
  if (n < 256) return new Uint8Array([0x18, n]);
  throw new Error("cborUint: value too large for test helper");
}

/** CBOR-encode a negative integer in the range we need for COSE labels. */
function cborNint(n: number): Uint8Array {
  // n is the negative value, e.g. -1, -2, -3
  const v = -1 - n;
  if (v < 24) return new Uint8Array([0x20 | v]);
  if (v < 256) return new Uint8Array([0x38, v]);
  throw new Error("cborNint: value too large for test helper");
}

function cborByteString(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 24)
    return concat(new Uint8Array([0x40 | bytes.length]), bytes);
  if (bytes.length < 256)
    return concat(new Uint8Array([0x58, bytes.length]), bytes);
  throw new Error("cborByteString: too long for test helper");
}

function cborTextString(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length < 24)
    return concat(new Uint8Array([0x60 | bytes.length]), bytes);
  throw new Error("cborTextString: too long for test helper");
}

/** Build a COSE_Key (EC2/ES256) CBOR map from raw x/y coordinates. */
function buildCoseKey(x: Uint8Array, y: Uint8Array): U8 {
  // Map with 5 pairs: kty(1)=2, alg(3)=-7, crv(-1)=1, x(-2)=..., y(-3)=...
  return concat(
    new Uint8Array([0xa5]), // map(5)
    cborUint(1),
    cborUint(2), // kty: EC2
    cborUint(3),
    cborNint(cose.COSEALG.ES256), // alg: ES256 (-7)
    cborNint(-1),
    cborUint(1), // crv: P-256
    cborNint(-2),
    cborByteString(x), // x
    cborNint(-3),
    cborByteString(y), // y
  );
}

/** Minimal CBOR map encoder for the attestationObject (3 known text keys). */
function buildAttestationObject(authData: Uint8Array): U8 {
  // { "fmt": "none", "attStmt": {}, "authData": <bytes> }
  return concat(
    new Uint8Array([0xa3]), // map(3)
    cborTextString("fmt"),
    cborTextString("none"),
    cborTextString("attStmt"),
    new Uint8Array([0xa0]), // empty map
    cborTextString("authData"),
    cborByteString(authData),
  );
}

function flags({ up, uv, at }: { up: boolean; uv: boolean; at: boolean }) {
  let f = 0;
  if (up) f |= 0x01;
  if (uv) f |= 0x04;
  if (at) f |= 0x40;
  return f;
}

function counterBytes(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

export interface SoftCredential {
  credentialID: U8;
  privateKey: CryptoKey;
  rpIdHash: U8;
  publicKeyCose: U8;
  counter: number;
}

/** Raw ECDSA signature (r||s) -> ASN.1 DER, as WebAuthn assertions require. */
function rawSigToDer(raw: Uint8Array): U8 {
  const r = raw.slice(0, 32);
  const s = raw.slice(32, 64);
  const trim = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let out = b.slice(i);
    if (out[0] & 0x80) out = concat(new Uint8Array([0]), out);
    return out;
  };
  const rt = trim(r);
  const st = trim(s);
  const body = concat(
    new Uint8Array([0x02, rt.length]),
    rt,
    new Uint8Array([0x02, st.length]),
    st,
  );
  return concat(new Uint8Array([0x30, body.length]), body);
}

/** Create a brand-new software authenticator + credential for an RP. */
export async function createSoftCredential(
  rpID: string,
): Promise<SoftCredential> {
  const keyPair = (await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  const jwk = await subtle.exportKey("jwk", keyPair.publicKey);
  const x = u8(isoBase64URL.toBuffer(jwk.x!));
  const y = u8(isoBase64URL.toBuffer(jwk.y!));
  const publicKeyCose = buildCoseKey(x, y);

  const credentialID = new Uint8Array(16) as U8;
  webcrypto.getRandomValues(credentialID);

  const rpIdHash = await sha256(new TextEncoder().encode(rpID));

  return {
    credentialID,
    privateKey: keyPair.privateKey,
    rpIdHash,
    publicKeyCose,
    counter: 0,
  };
}

function clientDataJSON(
  type: "webauthn.create" | "webauthn.get",
  challenge: string,
  origin: string,
): { json: string; bytes: U8 } {
  const json = JSON.stringify({ type, challenge, origin, crossOrigin: false });
  return { json, bytes: u8(new TextEncoder().encode(json)) };
}

/** Produce a RegistrationResponseJSON for the given challenge/origin. */
export function buildRegistrationResponse(
  cred: SoftCredential,
  challenge: string,
  origin: string,
) {
  const aaguid = new Uint8Array(16); // all-zero AAGUID
  const credIdLen = new Uint8Array(2);
  new DataView(credIdLen.buffer).setUint16(0, cred.credentialID.length, false);

  const attestedCredData = concat(
    aaguid,
    credIdLen,
    cred.credentialID,
    cred.publicKeyCose,
  );

  const authData = concat(
    cred.rpIdHash,
    new Uint8Array([flags({ up: true, uv: true, at: true })]),
    counterBytes(0),
    attestedCredData,
  );

  const attObj = buildAttestationObject(authData);
  const { bytes: cdjBytes } = clientDataJSON(
    "webauthn.create",
    challenge,
    origin,
  );

  return {
    id: isoBase64URL.fromBuffer(cred.credentialID),
    rawId: isoBase64URL.fromBuffer(cred.credentialID),
    response: {
      clientDataJSON: isoBase64URL.fromBuffer(cdjBytes),
      attestationObject: isoBase64URL.fromBuffer(attObj),
      transports: ["internal"],
    },
    type: "public-key",
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
}

/** Produce an AuthenticationResponseJSON (a signed assertion). */
export async function buildAuthenticationResponse(
  cred: SoftCredential,
  challenge: string,
  origin: string,
) {
  cred.counter += 1;
  const authData = concat(
    cred.rpIdHash,
    new Uint8Array([flags({ up: true, uv: true, at: false })]),
    counterBytes(cred.counter),
  );

  const { bytes: cdjBytes } = clientDataJSON("webauthn.get", challenge, origin);
  const clientDataHash = await sha256(cdjBytes);
  const signBase = concat(authData, clientDataHash);

  const rawSig = u8(
    await subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      cred.privateKey,
      signBase,
    ),
  );
  const der = rawSigToDer(rawSig);

  return {
    id: isoBase64URL.fromBuffer(cred.credentialID),
    rawId: isoBase64URL.fromBuffer(cred.credentialID),
    response: {
      clientDataJSON: isoBase64URL.fromBuffer(cdjBytes),
      authenticatorData: isoBase64URL.fromBuffer(authData),
      signature: isoBase64URL.fromBuffer(der),
      userHandle: undefined,
    },
    type: "public-key",
    clientExtensionResults: {},
    authenticatorAttachment: "platform",
  };
}
