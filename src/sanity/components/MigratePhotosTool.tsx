'use client'

import {useRef, useState} from 'react'
import {Badge, Box, Button, Card, Checkbox, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useClient} from 'sanity'
import {
  convertDocuments,
  inBatches,
  planMigration,
  restoreDocuments,
  type MigrationPlan,
  type OldDoc,
  type PhotoDoc,
  type TransactionLike,
} from '../../lib/migrate-photos'

/** The little the migration needs from the Studio's connection to Sanity. */
export type MigrationClient = {
  /** Every pin and photo document, drafts included. */
  fetchAll: () => Promise<OldDoc[]>
  /** The current version of specific documents. */
  fetchByIds: (ids: string[]) => Promise<OldDoc[]>
  /** Create the new Photos, then delete the old pins they replace (two all-or-nothing steps). */
  convert: (items: {from: OldDoc; to: PhotoDoc}[]) => Promise<void>
  /** Put original documents back from a backup. */
  restore: (docs: {_id: string; _type: string}[]) => Promise<void>
}

const BATCH_SIZE = 20

/** The Studio tool: hands the screen the Studio's own Sanity connection. */
export function MigratePhotosTool() {
  const sanity = useClient({apiVersion: '2026-01-01'}).withConfig({perspective: 'raw', useCdn: false})
  const connection = {transaction: () => sanity.transaction() as unknown as TransactionLike}
  const client: MigrationClient = {
    fetchAll: () => sanity.fetch<OldDoc[]>(`*[_type in ["pin", "photo"]]`),
    fetchByIds: (ids) => sanity.fetch<OldDoc[]>(`*[_id in $ids]`, {ids}),
    convert: (items) => convertDocuments(connection, items),
    restore: (docs) => restoreDocuments(connection, docs),
  }
  return <MigratePhotosView client={client} />
}

type Phase = 'start' | 'scanning' | 'scanned' | 'converting' | 'restoring'

const dateStamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')

/** System fields the server owns: left out when documents are put back from a backup. */
const stripSystemFields = (doc: Record<string, unknown>) => {
  const {_rev, _updatedAt, _createdAt, ...rest} = doc
  void _rev
  void _updatedAt
  void _createdAt
  return rest
}

export function MigratePhotosView({client}: {client: MigrationClient}) {
  const [phase, setPhase] = useState<Phase>('start')
  const [plan, setPlan] = useState<MigrationPlan | null>(null)
  const [backupSaved, setBackupSaved] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [progress, setProgress] = useState<{done: number; total: number} | null>(null)
  const [message, setMessage] = useState<{tone: 'positive' | 'critical' | 'default'; text: string} | null>(null)
  const restorePicker = useRef<HTMLInputElement | null>(null)

  // `clearMessage` is false when re-scanning after a convert or restore, so their result stays visible.
  const scan = async (clearMessage = true) => {
    setPhase('scanning')
    if (clearMessage) setMessage(null)
    try {
      const next = planMigration(await client.fetchAll())
      setPlan(next)
      setPhase('scanned')
      return next
    } catch (error) {
      setMessage({tone: 'critical', text: error instanceof Error ? error.message : 'Could not read the documents.'})
      setPhase('start')
      return null
    }
  }

  const downloadBackup = () => {
    if (!plan) return
    const body = JSON.stringify(
      {savedAt: new Date().toISOString(), note: 'Originals of the documents the Convert to Photos tool replaces.', documents: plan.convert.map((c) => c.from)},
      null,
      2,
    )
    const url = URL.createObjectURL(new Blob([body], {type: 'application/json'}))
    const link = document.createElement('a')
    link.href = url
    link.download = `tomvanz-photos-backup-${dateStamp()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBackupSaved(true)
  }

  const convert = async () => {
    if (!plan) return
    setPhase('converting')
    setMessage(null)
    const ids = plan.convert.map((c) => c.from._id)
    setProgress({done: 0, total: ids.length})
    try {
      let done = 0
      // One document first as a trial: if anything about the real Sanity differs from what we expect,
      // it fails here, on one document, before the rest are touched.
      const batches = [ids.slice(0, 1), ...inBatches(ids.slice(1), BATCH_SIZE)]
      for (const batch of batches) {
        // Read the batch fresh right before writing, so an edit made since the scan isn't lost.
        const fresh = planMigration(await client.fetchByIds(batch))
        if (fresh.convert.length > 0) await client.convert(fresh.convert)
        // Check it really took before moving on: each new Photo exists in the new shape, and each
        // old pin it replaced is gone.
        const wanted = fresh.convert.flatMap((c) => [c.to._id, c.from._id])
        const present = new Map((await client.fetchByIds([...new Set(wanted)])).map((d) => [d._id, d]))
        const problems = fresh.convert.filter((c) => {
          const made = present.get(c.to._id)
          const madeOk = made?._type === 'photo' && !('fish' in made) && !('caption' in made)
          const oldGone = c.from._id === c.to._id || !present.has(c.from._id)
          return !(madeOk && oldGone)
        })
        if (problems.length > 0) throw new Error(`${problems.length} document(s) did not convert as expected`)
        done += batch.length
        setProgress({done, total: ids.length})
      }
      const after = await scan(false)
      setMessage({
        tone: 'positive',
        text:
          after && after.convert.length === 0
            ? `Done. ${ids.length} documents are now Photos and nothing is left to convert.`
            : 'Finished, but some documents still need converting. Scan again and re-run if needed.',
      })
    } catch (error) {
      setMessage({
        tone: 'critical',
        text: `Stopped: ${error instanceof Error ? error.message : 'something failed'}. Each step either completes or doesn't happen, and a new Photo is always created before its old pin is removed, so nothing is lost. Scan again to see what's left; running again picks up where it stopped.`,
      })
      await scan(false)
    } finally {
      setProgress(null)
    }
  }

  const restore = async (file: File) => {
    setMessage(null)
    try {
      const parsed = JSON.parse(await file.text()) as {documents?: Record<string, unknown>[]}
      const docs = parsed.documents
      const valid = Array.isArray(docs) && docs.length > 0 && docs.every((d) => typeof d._id === 'string' && (d._type === 'pin' || d._type === 'photo'))
      if (!valid || !docs) throw new Error('That doesn’t look like a backup from this tool.')
      if (!window.confirm(`Put ${docs.length} documents back exactly as they were in this backup? Anything edited since will be overwritten.`)) return
      setPhase('restoring')
      for (const batch of inBatches(docs, BATCH_SIZE)) await client.restore(batch.map(stripSystemFields) as {_id: string; _type: string}[])
      await scan(false)
      setMessage({tone: 'positive', text: `Restored ${docs.length} documents from the backup.`})
    } catch (error) {
      setMessage({tone: 'critical', text: error instanceof Error ? error.message : 'Restore failed.'})
      setPhase(plan ? 'scanned' : 'start')
    }
  }

  const busy = phase === 'scanning' || phase === 'converting' || phase === 'restoring'
  const pins = plan?.convert.filter((c) => c.from._type === 'pin').length ?? 0
  const tripPhotos = plan?.convert.filter((c) => c.from._type === 'photo').length ?? 0
  const drafts = plan?.convert.filter((c) => c.from._id.startsWith('drafts.')).length ?? 0

  return (
    <Box padding={4} style={{maxWidth: 760, margin: '0 auto'}}>
      <Stack gap={4}>
        <Stack gap={2}>
          <Text size={3} weight="bold">
            Convert to Photos
          </Text>
          <Text size={1} muted>
            Moves the old pins and trip photos into the single Photo type. Each keeps its photo, location, title, note and date,
            and old shared links keep working. Run it once. It can be undone from the backup file.
          </Text>
        </Stack>

        {message ? (
          <Card padding={3} radius={2} tone={message.tone === 'critical' ? 'critical' : message.tone === 'positive' ? 'positive' : 'default'} border>
            <Text size={1}>{message.text}</Text>
          </Card>
        ) : null}

        <Flex align="center" gap={3}>
          <Button text={plan ? 'Scan again' : 'Scan'} tone="primary" disabled={busy} onClick={() => void scan(true)} />
          {phase === 'scanning' ? <Spinner muted /> : null}
        </Flex>

        {plan ? (
          <Stack gap={4}>
            <Card padding={3} radius={2} border>
              <Stack gap={3}>
                <Text size={1} weight="medium">
                  {plan.convert.length === 0
                    ? 'Nothing to convert.'
                    : `${plan.convert.length} documents will become Photos`}
                </Text>
                <Text size={1} muted>
                  {pins} old pin{pins === 1 ? '' : 's'} · {tripPhotos} trip photo{tripPhotos === 1 ? '' : 's'}
                  {drafts ? ` · ${drafts} unpublished draft${drafts === 1 ? '' : 's'} (they stay drafts)` : ''}
                  {plan.alreadyDone ? ` · ${plan.alreadyDone} already Photos` : ''}
                </Text>
              </Stack>
            </Card>

            {plan.skipped.length > 0 ? (
              <Card padding={3} radius={2} tone="caution" border>
                <Stack gap={3}>
                  <Text size={1} weight="medium">
                    {plan.skipped.length} left exactly as they are
                  </Text>
                  {plan.skipped.slice(0, 20).map((item) => (
                    <Text key={item.id} size={1} muted>
                      {item.title}: {item.reason}
                    </Text>
                  ))}
                </Stack>
              </Card>
            ) : null}

            {plan.convert.length > 0 ? (
              <Card padding={3} radius={2} border>
                <Stack gap={4}>
                  <Stack gap={2}>
                    <Flex align="center" gap={2}>
                      <Badge tone={backupSaved ? 'positive' : 'caution'} fontSize={0}>
                        Step 1
                      </Badge>
                      <Text size={1} weight="medium">
                        Save a backup
                      </Text>
                    </Flex>
                    <Text size={1} muted>
                      Downloads a file with the original of every document that will change.
                    </Text>
                    <Flex>
                      <Button text={backupSaved ? 'Backup saved. Download again' : 'Download backup'} mode="ghost" disabled={busy} onClick={downloadBackup} />
                    </Flex>
                  </Stack>

                  <Stack gap={2}>
                    <Flex align="center" gap={2}>
                      <Badge tone="caution" fontSize={0}>
                        Step 2
                      </Badge>
                      <Text size={1} weight="medium">
                        Convert
                      </Text>
                    </Flex>
                    <Flex align="center" gap={3}>
                      <Checkbox
                        id="convert-ok"
                        checked={confirmed}
                        disabled={busy || !backupSaved}
                        onChange={(event) => setConfirmed(event.currentTarget.checked)}
                      />
                      <Text as="label" size={1} muted>
                        <label htmlFor="convert-ok">I saved the backup, and nobody is editing photos right now.</label>
                      </Text>
                    </Flex>
                    <Flex align="center" gap={3}>
                      <Button
                        text={`Convert ${plan.convert.length} documents`}
                        tone="critical"
                        disabled={busy || !backupSaved || !confirmed}
                        onClick={() => void convert()}
                      />
                      {phase === 'converting' && progress ? (
                        <Flex align="center" gap={2}>
                          <Spinner muted />
                          <Text size={1} muted>
                            {progress.done} of {progress.total}
                          </Text>
                        </Flex>
                      ) : null}
                    </Flex>
                  </Stack>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        ) : null}

        <Card padding={3} radius={2} border>
          <Stack gap={3}>
            <Text size={1} weight="medium">
              Undo
            </Text>
            <Text size={1} muted>
              Choose the backup file to put the converted documents back exactly as they were.
            </Text>
            <Flex>
              <Button text="Restore from backup…" mode="ghost" disabled={busy} onClick={() => restorePicker.current?.click()} />
              <input
                ref={restorePicker}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void restore(file)
                }}
              />
            </Flex>
          </Stack>
        </Card>
      </Stack>
    </Box>
  )
}
