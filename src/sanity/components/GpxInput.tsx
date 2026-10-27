'use client'

import {useRef, useState} from 'react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {PatchEvent, set, unset, useClient, useFormValue, type ObjectInputProps} from 'sanity'
import {lineCoordinates} from '../../lib/sanity/types'
import {parseGpxToLine} from '../lib/parseGpx'

type FileValue = {
  asset?: {_ref: string}
}

export function GpxInput(props: ObjectInputProps) {
  const {value, readOnly} = props
  const fileValue = value as FileValue | undefined
  const client = useClient({apiVersion: '2026-01-01'})
  const documentId = useFormValue(['_id']) as string | undefined
  const route = useFormValue(['route']) as {coordinates?: unknown} | undefined
  const [message, setMessage] = useState<'idle' | 'ok' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasFile = Boolean(fileValue?.asset?._ref)
  const hasRoute = lineCoordinates(route).length >= 2

  async function onFile(file: File) {
    setError(null)
    try {
      const text = await file.text()
      const line = parseGpxToLine(text)
      const asset = await client.assets.upload('file', file, {filename: file.name})
      props.onChange(
        PatchEvent.from(
          set({
            _type: 'file',
            asset: {_type: 'reference', _ref: asset._id},
          }),
        ),
      )
      if (documentId) {
        const draftId = documentId.startsWith('drafts.') ? documentId : `drafts.${documentId}`
        await client.patch(draftId).set({
          route: {
            type: 'LineString',
            coordinates: JSON.stringify(line.coordinates),
          },
        }).commit()
      }
      setMessage('ok')
    } catch (caught) {
      setMessage('error')
      setError(caught instanceof Error ? caught.message : 'Couldn’t read that GPX. Try another file.')
    }
  }

  return (
    <Stack gap={3}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx,application/gpx+xml,application/xml,text/xml"
        hidden
        disabled={readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFile(file)
          event.target.value = ''
        }}
      />
      <Flex gap={2} align="center">
        <Button
          text={hasFile ? 'Replace GPX' : 'Upload GPX'}
          mode="ghost"
          disabled={readOnly}
          onClick={() => fileInputRef.current?.click()}
        />
        {hasFile ? (
          <Button
            text="Remove"
            tone="critical"
            mode="bleed"
            disabled={readOnly}
            onClick={() => {
              props.onChange(PatchEvent.from(unset()))
              if (documentId) {
                const draftId = documentId.startsWith('drafts.') ? documentId : `drafts.${documentId}`
                void client.patch(draftId).unset(['route']).commit()
              }
              setMessage('idle')
            }}
          />
        ) : null}
        {hasFile ? (
          <Text size={1} muted>
            GPX attached
          </Text>
        ) : null}
      </Flex>
      {message === 'ok' || hasRoute ? (
        <Card padding={3} radius={2} tone="positive">
          <Text size={1}>Got the route. Publish to put it on the map.</Text>
        </Card>
      ) : hasFile ? (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>File is attached, but the line isn’t parsed. Click Replace GPX and pick the file again.</Text>
        </Card>
      ) : null}
      {message === 'error' ? (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      ) : null}
    </Stack>
  )
}
