// Browser-safe: which tutors have an APPROVED object interview, so the picker may offer one to
// students. UI only; the live relay is the real gate and gives students approved objects only.
// Keep in step with src/content/objects (src/test/content-objects.test.ts checks this list).
export const TUTORS_WITH_APPROVED_OBJECTS: readonly ("geography" | "ppe")[] = ["geography", "ppe"];
