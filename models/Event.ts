import mongoose, { type Model, Schema } from "mongoose";

/**
 * Hackathons and contests. Written by the Telegram bot in internScraper (EVENT messages), read here.
 * `expiresAt` is when the event stops being shown (the end of its last day, IST); a TTL index drops the
 * document a few weeks later. Dates are plain "YYYY-MM-DD" strings so they never shift with time zones.
 */
export const EVENT_KEEP_AFTER_EXPIRY_SECONDS = 21 * 24 * 60 * 60;

export interface IEvent {
  _id: mongoose.Types.ObjectId;
  title: string;
  organiser?: string | null;
  type: "hackathon" | "contest" | "challenge" | "other";
  mode?: "online" | "offline" | "hybrid" | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  registrationDeadline?: string | null;
  datesKnown: boolean;
  expiresAt: Date;
  link: string;
  summary?: string | null;
  perks: string[];
  hiring: boolean;
  eligibility?: string | null;
  note?: string | null;
  imageUrl?: string | null;
  hidden: boolean;
  source?: string;
  submittedBy?: string | null;
  linkKey?: string;
  titleKey?: string;
  orgKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    organiser: { type: String, default: null },
    type: { type: String, enum: ["hackathon", "contest", "challenge", "other"], default: "other" },
    mode: { type: String, enum: ["online", "offline", "hybrid", null], default: null },
    location: { type: String, default: null },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    registrationDeadline: { type: String, default: null },
    datesKnown: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
    link: { type: String, required: true },
    summary: { type: String, default: null },
    perks: { type: [String], default: [] },
    hiring: { type: Boolean, default: false },
    eligibility: { type: String, default: null },
    note: { type: String, default: null },
    imageUrl: { type: String, default: null },
    hidden: { type: Boolean, default: false },
    source: { type: String, default: "telegram" },
    submittedBy: { type: String, default: null },
    linkKey: { type: String },
    titleKey: { type: String },
    orgKey: { type: String },
  },
  { collection: "events", timestamps: true, versionKey: false },
);

// Same indexes internScraper/scrapers/telegram_bot/events.py creates (matching specs, so neither side errors on the other's).
EventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: EVENT_KEEP_AFTER_EXPIRY_SECONDS });
EventSchema.index({ linkKey: 1 });
EventSchema.index({ titleKey: 1, orgKey: 1 });

const EventModel: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);
export default EventModel;
