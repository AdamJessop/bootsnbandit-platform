/** Diagnostic: complete a real enrolment ceremony against prod using the
 * repo's software authenticator fixture. Probe credential is deleted after. */
import {
  createSoftCredential,
  buildRegistrationResponse,
} from "../packages/core/src/auth/__fixtures__/softAuthenticator";

const ORIGIN = "https://admin.bootsnbandit.com";
const RP_ID = "bootsnbandit.com";
const INVITE = "AM1ZMeESL49XKR8EsGlhMl1NeuaZf4TH";

async function main() {
  const optRes = await fetch(`${ORIGIN}/api/auth/registration/options`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invite: INVITE }),
  });
  const setCookie = optRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const options = await optRes.json();
  console.log("options:", optRes.status, "rp:", JSON.stringify(options.rp), "cookie:", cookie ? "set" : "MISSING");

  const cred = await createSoftCredential(RP_ID);
  const regResponse = buildRegistrationResponse(cred, options.challenge, ORIGIN);

  const verifyRes = await fetch(`${ORIGIN}/api/auth/registration/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      response: regResponse,
      deviceName: "diagnostic-probe",
      invite: INVITE,
    }),
  });
  console.log("verify:", verifyRes.status, await verifyRes.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
