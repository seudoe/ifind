import mongoose, { type Model, Schema } from "mongoose";

/**
 * READ-ONLY view of the owner-populated `colleges` collection (one doc per college). The app never writes, indexes or
 * migrates it: strict=false so extra fields pass through, and there is no create path. Only `_id` and `name` are assumed.
 */
export interface ICollege {
    _id: mongoose.Types.ObjectId;
    name: string;
    state?: string | null;
    city?: string | null;
    domains?: string[];
    website?: string | null;
}

const CollegeSchema = new Schema<ICollege>({ name: { type: String, required: true } }, { strict: false, collection: "colleges", autoIndex: false, autoCreate: false });

if (process.env.NODE_ENV !== "production" && mongoose.models.College) delete mongoose.models.College;

const College: Model<ICollege> = mongoose.models.College || mongoose.model<ICollege>("College", CollegeSchema);
export default College;
