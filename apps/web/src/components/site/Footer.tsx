import Link from "next/link";
import { Camera, Globe, MapPin, Clock, Phone } from "lucide-react";
import {
  mergeShellSettings,
  SITE_NAV,
  type ShellSettings,
} from "@/lib/site-nav";
import { LEGAL_NAV } from "@/lib/legal";

/**
 * Four-column heritage footer: brand + socials, Explore links, Visit
 * (address/hours/phone) and Studio address block, over a bottom strip with the
 * copyright and the legal links (privacy, data deletion). `studio` carries the CMS
 * SiteSettings merged over the hardcoded fallbacks (see mergeShellSettings);
 * omitting it renders the pure fallbacks. Phone and social links render only
 * when the CMS has them — there is no invented fallback.
 */
export function Footer({
  studio = mergeShellSettings(null),
}: {
  studio?: ShellSettings;
}) {
  return (
    <footer className="foot">
      <div className="wrap-wide">
        <div className="foot-grid">
          <div>
            <span className="flogo inline-block" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/bb-logo.png"
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
              />
            </span>
            <p className="muted max-w-[32ch]">
              Heritage tattooing in Worksop. Custom work, flash drops and the
              Bandit Pass — proper brew included.
            </p>
            {(studio.instagram || studio.facebook) && (
              <div className="social-row mt-4">
                {studio.instagram && (
                  <a
                    href={studio.instagram}
                    className="icon-btn"
                    aria-label="Instagram"
                  >
                    <Camera className="ic" />
                  </a>
                )}
                {studio.facebook && (
                  <a
                    href={studio.facebook}
                    className="icon-btn"
                    aria-label="Facebook"
                  >
                    <Globe className="ic" />
                  </a>
                )}
              </div>
            )}
          </div>

          <div>
            <h6>Explore</h6>
            <div className="foot-links">
              {SITE_NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h6>Visit</h6>
            <div className="foot-links">
              <span className="row gap-3">
                <MapPin className="ic text-bb-gold" /> {studio.address}
              </span>
              <span className="row gap-3">
                <Clock className="ic text-bb-gold" /> {studio.hours}
              </span>
              {studio.phone && (
                <a
                  href={`tel:${studio.phone.replace(/\s/g, "")}`}
                  className="row gap-3"
                >
                  <Phone className="ic text-bb-gold" /> {studio.phone}
                </a>
              )}
            </div>
          </div>

          <div>
            <h6>The Studio</h6>
            <p className="muted">
              {studio.name}
              <br />
              {studio.address}
              <br />
              {studio.hours}
            </p>
          </div>
        </div>

        <div className="foot-bottom">
          <span>
            © {new Date().getFullYear()} {studio.name}. All rights reserved.
          </span>
          <nav className="foot-legal" aria-label="Legal">
            {LEGAL_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <span>Fully licensed studio · Worksop, Nottinghamshire</span>
        </div>
      </div>
    </footer>
  );
}
