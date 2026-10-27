import { useState } from 'react';

import { Button, ErrorText, T } from '@/components/ui';
import { exportFileName, toSplitwiseCsv } from '@/domain/splitwise-export';
import { todayLocal } from '@/lib/dates';
import { exportCsvFile } from '@/lib/export-file';
import type { Expense, Group, Member } from '@/lib/types';

/**
 * "Export CSV": the whole group as a spreadsheet, in the same format Splitwise uses,
 * so it can be opened in Excel / Google Sheets or imported again (into FairTab or Splitwise).
 * `members` must include people who left, or the totals would not add up.
 */
export function ExportCsvButton({ group, members, expenses }: { group: Group; members: Member[]; expenses: Expense[] }) {
  const [status, setStatus] = useState('');
  const [error, setError] = useState<unknown>(null);
  if (expenses.length === 0) return null;

  const exportCsv = async () => {
    setStatus('');
    setError(null);
    try {
      const csv = toSplitwiseCsv({ members: members.map((m) => ({ id: m.id, name: m.display_name })), expenses });
      const fileName = exportFileName(group.name, todayLocal());
      if ((await exportCsvFile(fileName, csv)) === 'downloaded') {
        setStatus(`Downloaded ${fileName}. Open it with Excel, Google Sheets or Numbers.`);
      }
    } catch (e) {
      setError(e);
    }
  };

  return (
    <>
      <Button title="Export CSV" variant="secondary" onPress={exportCsv} />
      {status ? <T variant="small" muted>{status}</T> : null}
      <ErrorText error={error} />
    </>
  );
}
