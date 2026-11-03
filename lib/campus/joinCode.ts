import crypto from "crypto";
import { CAMPUS_JOIN_CODE_LENGTH } from "@/types/campus";

/** No 0/O/1/I/L: survives being read aloud or typed from a WhatsApp message. 31 symbols ^ 8 is about 8.5e11. */
export const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Cryptographically random, uniform (rejection sampling, no modulo bias). */
export function generateJoinCode(length = CAMPUS_JOIN_CODE_LENGTH): string {
    const n = JOIN_CODE_ALPHABET.length;
    const limit = 256 - (256 % n);
    let out = "";
    while (out.length < length) {
        for (const b of crypto.randomBytes(length * 2)) {
            if (b < limit && out.length < length) out += JOIN_CODE_ALPHABET[b % n];
        }
    }
    return out;
}

/** Upper-cases and strips spaces/dashes ("abcd-1234" -> "ABCD1234"); null when it can't be a code. */
export function normalizeJoinCode(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const code = input.replace(/[\s-]/g, "").toUpperCase();
    if (code.length !== CAMPUS_JOIN_CODE_LENGTH) return null;
    return [...code].every((c) => JOIN_CODE_ALPHABET.includes(c)) ? code : null;
}

/** Unique code for a new/rotated entity: retries on the (astronomically rare) collision. */
export async function uniqueJoinCode(exists: (code: string) => Promise<boolean>): Promise<string> {
    for (let i = 0; i < 8; i++) {
        const code = generateJoinCode();
        if (!(await exists(code))) return code;
    }
    throw new Error("Could not generate a unique join code");
}
