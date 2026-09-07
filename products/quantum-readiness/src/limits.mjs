// One DNS operation (A + AAAA), then at most three addresses and two offers each.
export const LIMITS = Object.freeze({
  addresses: 3, dnsAnswers: 16, connections: 6, concurrency: 1,
  probeMs: 4500, dnsMs: 2000, assessmentMs: 30000,
  incomingBytes: 131072, outgoingBytes: 32768,
  assessmentIncomingBytes: 786432, assessmentOutgoingBytes: 196608
});
