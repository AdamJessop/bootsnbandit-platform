import Link from "next/link";
import { Camera, Globe, MapPin, Clock, Phone } from "lucide-react";
import {
  mergeShellSettings,
  SITE_NAV,
  type ShellSettings,
} from "@/lib/site-nav";
import { Mark } from "./Mark";

/**
 * Four-column heritage footer: brand + socials, Explore links, Visit
 * (address/hours/phone) and Studio address block. `studio` carries the CMS
 * SiteSettings merged over the hardcoded fallbacks (see mergeShellSettings);
 * omitting it renders the pure fallbacks.
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
            <span className="flogo crimson inline-block" aria-hidden>
              <Mark className="h-16 w-16 text-bb-crimson" />
            </span>
            <p className="muted max-w-[32ch]">
              Heritage tattooing in Worksop. Custom work, flash drops and the
              Bandit Pass — proper brew included.
            </p>
            <div className="social-row mt-4">
              <a
                href={studio.instagram}
                className="icon-btn"
                aria-label="Instagram"
              >
                <Camera className="ic" />
              </a>
              <a
                href={studio.facebook}
                className="icon-btn"
                aria-label="Facebook"
              >
                <Globe className="ic" />
              </a>
            </div>
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
              <a
                href={`tel:${studio.phone.replace(/\s/g, "")}`}
                className="row gap-3"
              >
                <Phone className="ic text-bb-gold" /> {studio.phone}
              </a>
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
          <span>Fully licensed studio · Worksop, Nottinghamshire</span>
        </div>
      </div>
    </footer>
  );
}
