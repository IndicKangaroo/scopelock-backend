import { extractAgreementFromTranscript } from "./service.js";
const transcript = `
John from ABC Construction agrees with Mike, the homeowner,
to replace the kitchen cabinets at 123 Main Street.

The work will include removing the existing cabinets, supplying
and installing new cabinets, and completing the installation
within 30 days.

The total price is ₹2,50,000. The homeowner will pay 50% upfront
and the remaining 50% after completion.

Any additional work must be agreed upon by both parties before
it is performed.
`;

async function main(): Promise<void> {
  console.log("Calling real OpenAI provider...\n");

  const result = await extractAgreementFromTranscript(transcript);

  console.log("AI extraction succeeded.\n");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error("\nAI smoke test FAILED:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exit(1);
});