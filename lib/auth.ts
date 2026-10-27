export function normalizeRegistrationNumber(regNo: string) {
  return regNo.trim().toUpperCase();
}

export function registrationEmail(regNo: string) {
  const normalized = normalizeRegistrationNumber(regNo);
  const encoded = Array.from(new TextEncoder().encode(normalized), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return `reg-${encoded}@samadhan.invalid`;
}