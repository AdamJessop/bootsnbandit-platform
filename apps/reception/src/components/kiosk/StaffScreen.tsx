"use client";

import { ArrowLeft, Check } from "lucide-react";
import { artistStatusLabel, type ArtistStatus } from "@bnb/core/artist-status";
import { ArtistAvatar } from "./ArtistAvatar";
import type { BoardArtist } from "./kiosk-logic";

/** Staff check-in overlay — tap a profile to check in/out for the day. */
export function StaffScreen({
  artists,
  onToggle,
  onExit,
}: {
  artists: BoardArtist[];
  onToggle: (artistId: string, present: boolean) => void;
  onExit: () => void;
}) {
  return (
    <div className="rk-screen">
      <div className="rk-screen-head">
        <button className="rk-back" onClick={onExit}>
          <ArrowLeft className="ic" />
          Back
        </button>
        <div>
          <div className="rk-screen-title">Staff check-in</div>
          <div className="rk-screen-sub">
            Tap your profile to check in or out for the day.
          </div>
        </div>
      </div>
      <div className="rk-screen-body">
        <div className="rk-staff-grid">
          {artists.map((a) => (
            <button
              key={a.id}
              className={"rk-staff-tile " + (a.checkedIn ? "in" : "")}
              onClick={() => onToggle(a.id, !a.checkedIn)}
            >
              <ArtistAvatar artist={a} size={52} />
              <span>
                <b>{a.name}</b>
                <small>
                  {artistStatusLabel(a.status as ArtistStatus)}
                  {a.onLeave ? " · On leave" : ""}
                </small>
              </span>
              <span className="rk-staff-state">
                {a.checkedIn ? (
                  <span className="rk-pill free">
                    <Check className="ic" style={{ width: 12, height: 12 }} />
                    In
                  </span>
                ) : (
                  <span className="rk-pill out">Out</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
