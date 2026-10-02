/**
 * Export the anonymous answer dataset to data/exports/ as CSV and JSONL.
 *   npm run export-answers                -> everything
 *   npm run export-answers -- 2026-10-01  -> rows recorded on/after that day
 */
import fs from "node:fs";
import path from "node:path";
import { answersToCsv, answersToJsonl, listAnswerRecords } from "../lib/answers";

async function main() {
  const since = process.argv[2];
  const rows = await listAnswerRecords(since);
  const dir = path.resolve(process.cwd(), "data/exports");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(dir, `answers-${stamp}.csv`);
  const jsonlPath = path.join(dir, `answers-${stamp}.jsonl`);
  fs.writeFileSync(csvPath, answersToCsv(rows));
  fs.writeFileSync(jsonlPath, answersToJsonl(rows));
  console.log(`Exported ${rows.length} anonymous answer record(s) to\n  ${csvPath}\n  ${jsonlPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
