import mongoose, { type Document, type Model, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  password?: string;
  linkedinId?: string;
  profilePicture?: string | null;
  role: "student";
  city: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false, select: false },
    linkedinId: { type: String, default: null, trim: true },
    profilePicture: { type: String, default: null },
    role: { type: String, enum: ["student"], default: "student" },
    city: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ linkedinId: 1 }, { unique: true, sparse: true });

// Delete cached model in Next.js dev environment to ensure schema updates take effect
if (process.env.NODE_ENV !== "production" && mongoose.models.User) {
  delete mongoose.models.User;
}

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
