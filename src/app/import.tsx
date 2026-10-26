import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Chip, ChipRow, ErrorText, Field, Screen, T } from '@/components/ui';
import { formatMoney, parseSplitwiseCsv, type ImportResult } from '@/domain';
import { useImportGroup, useImportMore } from '@/lib/queries';

export default function ImportScreen() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  function load(text: string) {
    try {
      setResult(parseSplitwiseCsv(text));
      setParseError(null);
    } catch (e) {
      setResult(null);
      setParseError(e instanceof Error ? e.message : String(e));
    }
  }

  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    try {
      const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
      load(text);
    } catch (e) {
      setParseError(`Could not read the file: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (result) return <ImportPreview result={result} onCancel={() => setResult(null)} />;

  return (
    <Screen>
      <Card>
        <T variant="heading">How to export from Splitwise</T>
        <T>1. Open splitwise.com in a browser and go to the group.</T>
        <T>2. Click the settings (gear) icon and choose “Export as spreadsheet”.</T>
        <T>3. Choose the downloaded .csv file here. Repeat for each group.</T>
      </Card>
      <Button title="Choose CSV file" onPress={pickFile} />
      <Button title={showPaste ? 'Hide' : 'Or paste the CSV text'} variant="secondary" onPress={() => setShowPaste(!showPaste)} />
      {showPaste ? (
        <>
          <Field label="CSV" value={pasted} onChangeText={setPasted} multiline style={{ minHeight: 160, textAlignVertical: 'top' }} />
          <Button title="Read pasted text" disabled={!pasted.trim()} onPress={() => load(pasted)} />
        </>
      ) : null}
      <ErrorText error={parseError} />
    </Screen>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

const BATCH = 500; // entries per request, so each one stays well under Supabase's time limit

function ImportPreview({ result, onCancel }: { result: ImportResult; onCancel: () => void }) {
  const [name, setName] = useState('Imported from Splitwise');
  const [me, setMe] = useState<string | null>(null);
  const [acceptSkipped, setAcceptSkipped] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const importGroup = useImportGroup();
  const importMore = useImportMore();

  const counts = new Map<string, number>();
  for (const e of result.entries) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
  const mainCurrency = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD';
  const totals = new Map<string, number>();
  for (const e of result.entries) if (e.kind === 'expense') totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  // Rows that do not change anyone's balance are safe to skip; anything else changes the totals.
  const harmful = result.skipped.filter((r) => r.reason !== 'does not change any balance');
  const busy = progress !== null;

  async function runImport() {
    setError(null);
    let done = 0;
    let groupId: string | null = null;
    try {
      setProgress(`Importing… 0 of ${result.entries.length}`);
      groupId = await importGroup.mutateAsync({
        p_name: name.trim(),
        p_currency: mainCurrency,
        p_members: result.members,
        p_me: me,
        p_entries: result.entries.slice(0, BATCH),
      });
      done = Math.min(BATCH, result.entries.length);
      while (done < result.entries.length) {
        setProgress(`Importing… ${done} of ${result.entries.length}`);
        const batch = result.entries.slice(done, done + BATCH);
        await importMore.mutateAsync({ p_group_id: groupId, p_entries: batch });
        done += batch.length;
      }
      router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (e) {
      setProgress(null);
      const message = e instanceof Error ? e.message : String(e);
      setError(
        groupId
          ? new Error(`Stopped after ${done} of ${result.entries.length} entries: ${message}. Delete the new group in its settings and try again.`)
          : e,
      );
    }
  }

  return (
    <Screen>
      <Card>
        <T variant="heading">Found {plural(result.entries.length, 'entry', 'entries')}</T>
        <T muted>
          {plural(result.entries.filter((e) => e.kind === 'payment').length, 'payment', 'payments')} ·{' '}
          {[...totals].map(([c, v]) => formatMoney(v, c)).join(', ') || 'no expenses'} in total
        </T>
        {result.skipped.length > harmful.length ? (
          <T variant="small" muted>
            Skipped {plural(result.skipped.length - harmful.length, 'row that does', 'rows that do')} not change anyone’s balance.
          </T>
        ) : null}
      </Card>
      {harmful.length > 0 ? (
        <Card>
          <T variant="heading">{plural(harmful.length, 'row', 'rows')} could not be read</T>
          <T muted>These would change balances, so totals will differ from Splitwise if you import without them.</T>
          {harmful.slice(0, 10).map((r) => (
            <T key={r.line} variant="small">Line {r.line}: {r.reason}</T>
          ))}
          {harmful.length > 10 ? <T variant="small" muted>…and {harmful.length - 10} more</T> : null}
          <ChipRow>
            <Chip label="Import without these rows" selected={acceptSkipped} onPress={() => setAcceptSkipped(!acceptSkipped)} />
          </ChipRow>
        </Card>
      ) : null}
      <Field label="Group name" value={name} onChangeText={setName} maxLength={100} />
      <Card>
        <T variant="label" muted>Which one is you?</T>
        <ChipRow>
          {result.members.map((m) => (
            <Chip key={m} label={m} selected={me === m} onPress={() => setMe(me === m ? null : m)} />
          ))}
        </ChipRow>
        <T variant="small" muted>The others are added by name. Share the invite link and they can claim their name.</T>
      </Card>
      {progress ? <T muted>{progress}</T> : null}
      <ErrorText error={error} />
      <Button
        title="Import"
        disabled={!me || !name.trim() || (harmful.length > 0 && !acceptSkipped) || result.entries.length === 0}
        loading={busy}
        onPress={runImport}
      />
      <Button title="Choose another file" variant="secondary" onPress={onCancel} disabled={busy} />
    </Screen>
  );
}
