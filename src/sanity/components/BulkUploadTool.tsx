'use client'

import {useCallback, useRef, useState} from 'react'
import {Badge, Box, Button, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {useClient} from 'sanity'
import {useRouter} from 'sanity/router'
import {isPhotoFile, photoFromUpload, readPhotoMeta, runPool} from '../../lib/bulk-upload'

/** The little the uploader needs from the Studio's connection to Sanity. */
export type UploaderClient = {
  uploadImage: (file: File) => Promise<{_id: string}>
  /** The id of a photo already using this image, if any. */
  findByAsset: (assetId: string) => Promise<string | null>
  createPhoto: (doc: ReturnType<typeof photoFromUpload>) => Promise<{_id: string}>
}

type Status = 'queued' | 'uploading' | 'done' | 'no-location' | 'duplicate' | 'skipped' | 'error'

type Row = {
  id: number
  name: string
  status: Status
  note?: string
  docId?: string
}

const CONCURRENCY = 3

const STATUS_LABEL: Record<Status, string> = {
  queued: 'Waiting',
  uploading: 'Uploading',
  done: 'On the map',
  'no-location': 'Needs a location',
  duplicate: 'Already uploaded',
  skipped: 'Skipped',
  error: 'Failed',
}

const STATUS_TONE: Record<Status, 'default' | 'positive' | 'caution' | 'critical' | 'primary'> = {
  queued: 'default',
  uploading: 'primary',
  done: 'positive',
  'no-location': 'caution',
  duplicate: 'default',
  skipped: 'default',
  error: 'critical',
}

/** The Studio tool: hands the screen the Studio's own Sanity connection. */
export function BulkUploadTool() {
  const client = useClient({apiVersion: '2026-01-01'})
  const router = useRouter()
  const uploader: UploaderClient = {
    uploadImage: (file) => client.assets.upload('image', file, {filename: file.name}),
    findByAsset: (assetId) =>
      client.fetch<string | null>(
        `*[_type == "photo" && image.asset._ref == $id][0]._id`,
        {id: assetId},
      ),
    createPhoto: (doc) => client.create(doc),
  }
  return <BulkUploadView uploader={uploader} openDocument={(id) => router.navigateIntent('edit', {id, type: 'photo'})} />
}

/**
 * Drop in a pile of photos and each one becomes a Photo: uploaded, placed from its own GPS data,
 * dated from when it was taken. Drone photos are spotted from their DJI file names by the site.
 */
export function BulkUploadView({
  uploader,
  openDocument,
}: {
  uploader: UploaderClient
  openDocument: (docId: string) => void
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const nextId = useRef(1)
  const filesById = useRef(new Map<number, File>())
  const picker = useRef<HTMLInputElement | null>(null)

  const patchRow = useCallback((id: number, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.id === id ? {...row, ...patch} : row)))
  }, [])

  const processOne = useCallback(
    async (id: number) => {
      const file = filesById.current.get(id)
      if (!file) return
      patchRow(id, {status: 'uploading', note: undefined})
      try {
        const meta = await readPhotoMeta(file)
        const asset = await uploader.uploadImage(file)

        // Uploading the same photo twice gives back the same asset: don't make a second photo for it.
        const existing = await uploader.findByAsset(asset._id)
        if (existing) {
          patchRow(id, {status: 'duplicate', docId: existing, note: 'Already on the map.'})
          return
        }

        const doc = await uploader.createPhoto(photoFromUpload(asset._id, meta))
        if (meta.lat == null) {
          patchRow(id, {
            status: 'no-location',
            docId: doc._id,
            note: 'No GPS in this photo. Open it and drop a pin, or it won’t show on the map.',
          })
        } else {
          patchRow(id, {status: 'done', docId: doc._id})
        }
      } catch (error) {
        patchRow(id, {status: 'error', note: error instanceof Error ? error.message : 'Upload failed.'})
      }
    },
    [uploader, patchRow],
  )

  const runIds = useCallback(
    async (ids: number[]) => {
      setRunning(true)
      await runPool(ids, CONCURRENCY, processOne)
      setRunning(false)
    },
    [processOne],
  )

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const added: Row[] = []
      for (const file of Array.from(list)) {
        const id = nextId.current++
        if (!isPhotoFile(file)) {
          added.push({id, name: file.name, status: 'skipped', note: 'Not a photo.'})
          continue
        }
        filesById.current.set(id, file)
        added.push({id, name: file.name, status: 'queued'})
      }
      setRows((current) => [...current, ...added])
      void runIds(added.filter((row) => row.status === 'queued').map((row) => row.id))
    },
    [runIds],
  )

  const counts = rows.reduce(
    (acc, row) => ({...acc, [row.status]: (acc[row.status] ?? 0) + 1}),
    {} as Partial<Record<Status, number>>,
  )
  const finished = rows.filter((row) => row.status !== 'queued' && row.status !== 'uploading').length
  const failed = rows.filter((row) => row.status === 'error').map((row) => row.id)

  return (
    <Box padding={4} style={{maxWidth: 760, margin: '0 auto'}}>
      <Stack gap={4}>
        <Stack gap={2}>
          <Text size={3} weight="bold">
            Bulk upload
          </Text>
          <Text size={1} muted>
            Drop in as many photos as you like. Each is placed from the GPS in the photo and dated from when it was
            taken. Drone photos are spotted automatically from their file names.
          </Text>
        </Stack>

        <Card
          padding={5}
          radius={3}
          tone={dragging ? 'primary' : 'default'}
          border
          style={{borderStyle: 'dashed', textAlign: 'center', cursor: 'pointer'}}
          onDragOver={(event: React.DragEvent) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: React.DragEvent) => {
            event.preventDefault()
            setDragging(false)
            if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files)
          }}
          onClick={() => picker.current?.click()}
        >
          <Stack gap={3}>
            <Text size={2} weight="medium">
              Drop photos here
            </Text>
            <Text size={1} muted>
              or click to choose them
            </Text>
          </Stack>
          <input
            ref={picker}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </Card>

        {rows.length > 0 ? (
          <Stack gap={3}>
            <Flex align="center" justify="space-between" gap={3} wrap="wrap">
              <Flex align="center" gap={2}>
                {running ? <Spinner muted /> : null}
                <Text size={1} muted>
                  {finished} of {rows.length} done
                  {counts['no-location'] ? ` · ${counts['no-location']} need a location` : ''}
                  {counts.duplicate ? ` · ${counts.duplicate} already uploaded` : ''}
                  {counts.error ? ` · ${counts.error} failed` : ''}
                </Text>
              </Flex>
              <Flex gap={2}>
                {failed.length > 0 && !running ? (
                  <Button text="Retry failed" mode="ghost" tone="critical" fontSize={1} onClick={() => void runIds(failed)} />
                ) : null}
                {!running ? (
                  <Button
                    text="Clear list"
                    mode="bleed"
                    fontSize={1}
                    onClick={() => {
                      setRows([])
                      filesById.current.clear()
                    }}
                  />
                ) : null}
              </Flex>
            </Flex>

            <Card border radius={2} overflow="hidden">
              <Stack>
                {rows.map((row, index) => (
                  <Card key={row.id} padding={3} borderTop={index > 0} tone="default">
                    <Flex align="center" justify="space-between" gap={3}>
                      <Stack gap={2} style={{minWidth: 0}}>
                        <Text size={1} weight="medium" textOverflow="ellipsis">
                          {row.name}
                        </Text>
                        {row.note ? (
                          <Text size={1} muted>
                            {row.note}
                          </Text>
                        ) : null}
                      </Stack>
                      <Flex align="center" gap={2} style={{flexShrink: 0}}>
                        {row.docId && (row.status === 'no-location' || row.status === 'duplicate') ? (
                          <Button
                            text="Open"
                            mode="ghost"
                            fontSize={1}
                            padding={2}
                            onClick={() => openDocument(row.docId!)}
                          />
                        ) : null}
                        <Badge tone={STATUS_TONE[row.status]} fontSize={0}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </Flex>
                    </Flex>
                  </Card>
                ))}
              </Stack>
            </Card>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
