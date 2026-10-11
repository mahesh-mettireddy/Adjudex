// Sample library: ready-to-use mandates and executions for the demo.

export const SAMPLE_MANDATE = Object.freeze({
  id: "MND-2026-00417",
  signedBy: "User",
  signedAt: "2026-10-08T10:42:00Z",
  signatureHash: "0x9f3a…c71e",
  currency: "INR",
  maxPricePerNight: 8000,
  allowedMerchants: ["OYO", "Taj Bookings", "MakeMyTrip"],
  refundableRequired: true,
  stayWindow: { checkIn: "2026-11-14", checkOut: "2026-11-16" },
  softConstraints: [{ key: "quietRoom", label: "a quiet room" }],
});

export const SAMPLES = Object.freeze([
  {
    id: "clean",
    name: "Clean case",
    expectedVerdict: "IN_MANDATE",
    execution: {
      caseId: "EXE-SAMPLE-CLEAN",
      merchant: "OYO",
      price: 7200,
      currency: "INR",
      refundable: true,
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      quietEvidence: "verified",
      softInfo: "Quiet room verified by listing metadata.",
    },
  },
  {
    id: "breach",
    name: "Hard breach",
    expectedVerdict: "OUT_OF_MANDATE",
    execution: {
      caseId: "EXE-SAMPLE-BREACH",
      merchant: "Gucci Hotels",
      price: 11500,
      currency: "INR",
      refundable: false,
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      quietEvidence: "absent",
      softInfo: "Room is 350m from the venue.",
    },
  },
  {
    id: "merchant_breach",
    name: "Merchant breach",
    expectedVerdict: "OUT_OF_MANDATE",
    execution: {
      caseId: "EXE-SAMPLE-MERCHANT",
      merchant: "Sunset Suites",
      price: 7000,
      currency: "INR",
      refundable: true,
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      quietEvidence: "verified",
      softInfo: "Quiet room verified by listing metadata.",
    },
  },
  {
    id: "ambiguous",
    name: "Ambiguous case",
    expectedVerdict: "AMBIGUOUS_UNVERIFIABLE",
    execution: {
      caseId: "EXE-SAMPLE-AMBIGUOUS",
      merchant: "OYO",
      price: 7200,
      currency: "INR",
      refundable: true,
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      quietEvidence: "absent",
      softInfo: "The listing never mentions noise or room location.",
    },
  },
  {
    id: "contradicted",
    name: "Contradictory evidence",
    expectedVerdict: "OUT_OF_MANDATE",
    execution: {
      caseId: "EXE-SAMPLE-CONTRADICTED",
      merchant: "MakeMyTrip",
      price: 7800,
      currency: "INR",
      refundable: true,
      checkIn: "2026-11-14",
      checkOut: "2026-11-16",
      quietEvidence: "contradicted",
      softInfo: "Guest reviews mention loud construction next door.",
    },
  },
]);

export const getSample = (id) => SAMPLES.find((s) => s.id === id);
