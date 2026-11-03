/** User-facing campus strings used by both the UI and API errors (single source). */
export const JOIN_CERTAINTY = "Join only if you are certain that this is the official campus of your college.";
export const LEAVE_CERTAINTY = "Leave only if you are certain that the campus you are joining is the official one.";

/** Consequences listed in the big red warning when leaving or switching. */
export const LEAVE_CONSEQUENCES = [
    "You lose access to this campus's internships, events and updates.",
    "You stop receiving its emails and messages.",
    "Your applications there stay on record, but you can no longer act on them from the new campus.",
    "You must use its join code to come back.",
    "The staff of this campus will see that you left.",
] as const;

export const ACCEPTED_WITHDRAW_WARNING = "You are withdrawing an offer you already accepted. The campus staff will be notified.";

export const BANNER_NO_ENTITY = "Your college hasn't set up campus internships on iFind yet.";
export const BANNER_NOT_JOINED = "Join your college's campus to see internships and events.";
export const NO_ENTITY_BODY = "Your college's placement coordinator hasn't set up this college on iFind yet. Ask them to create it.";

export const ERR = {
    alreadyJoined: "You are already part of a campus. Leaving it comes with consequences.",
    hasActiveApplications: "Withdraw all your active applications in this campus before leaving or switching.",
    confirmRequired: "Please confirm to continue.",
    invalidCode: "That code didn't match any campus.",
} as const;
