'use client'

import {useEffect, useRef, useState} from 'react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import exifr from 'exifr'
import {PatchEvent, set, unset, useClient, useFormValue, type ObjectInputProps} from 'sanity'

type GpsStatus = 'idle' | 'found' | 'missing' | 'manual'

type ImageValue = {
  asset?: {_ref: string}
}

export function CatchImageInput(props: ObjectInputProps) {
  const {value, readOnly, renderDefault} = props
  const image = value as ImageValue | undefined
  const client = useClient({apiVersion: '2026-01-01'})
  const documentId = useFormValue(['_id']) as string | undefined
  const location = useFormValue(['location']) as {lat?: number; lng?: number} | undefined
  const [status, setStatus] = useState<GpsStatus>('idle')
  const lastAsset = useRef<string | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const hasLocation = location?.lat != null && location?.lng != null
  const assetRef = image?.asset?._ref

  useEffect(() => {
    if (!assetRef) {
      lastAsset.current = undefined
      if (!hasLocation) setStatus('idle')
      return
    }
    if (hasLocation) {
      setStatus((current) => (current === 'found' ? 'found' : 'manual'))
      return
    }
    if (lastAsset.current === assetRef && status === 'missing') return

    let cancelled = false
    lastAsset.current = assetRef

    void (async () => {
      const asset = await client.fetch<{url?: string; loc?: {lat: number; lng: number}} | null>(
        `*[_id == $id][0]{ url, "loc": metadata.location }`,
        {id: assetRef},
      )
      if (cancelled) return
      if (asset?.loc?.lat != null && asset.loc.lng != null) {
        setStatus('found')
        await patchLocation(asset.loc.lat, asset.loc.lng)
        return
      }
      setStatus('missing')
    })()

    return () => {
      cancelled = true
    }
    // patchLocation is stable enough for this asset-bound effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetRef, hasLocation, client])

  async function patchLocation(lat: number, lng: number) {
    if (!documentId) return
    const draftId = documentId.startsWith('drafts.') ? documentId : `drafts.${documentId}`
    await client
      .patch(draftId)
      .set({location: {_type: 'geopoint', lat, lng}})
      .commit({autoGenerateArrayKeys: true})
  }

  async function onFile(file: File) {
    const gps = await exifr.gps(file)
    if (gps?.latitude != null && gps?.longitude != null) {
      setStatus('found')
      await patchLocation(gps.latitude, gps.longitude)
    } else {
      setStatus('missing')
    }

    const asset = await client.assets.upload('image', file, {filename: file.name})
    props.onChange(
      PatchEvent.from(
        set({
          _type: 'image',
          asset: {_type: 'reference', _ref: asset._id},
        }),
      ),
    )
    lastAsset.current = asset._id
  }

  return (
    <Stack gap={3}>
      {renderDefault(props)}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFile(file)
          event.target.value = ''
        }}
      />
      <Flex gap={2}>
        <Button
          text={assetRef ? 'Replace photo' : 'Upload photo'}
          mode="ghost"
          disabled={readOnly}
          onClick={() => fileInputRef.current?.click()}
        />
        {assetRef ? (
          <Button
            text="Remove"
            tone="critical"
            mode="bleed"
            disabled={readOnly}
            onClick={() => {
              props.onChange(PatchEvent.from(unset()))
              setStatus('idle')
            }}
          />
        ) : null}
      </Flex>
      {status === 'found' ? (
        <Card padding={3} radius={2} tone="positive">
          <Text size={1}>Found location from this photo.</Text>
        </Card>
      ) : null}
      {status === 'missing' && !hasLocation ? (
        <Card padding={3} radius={2} tone="critical">
          <Stack gap={2}>
            <Text size={1} weight="semibold">
              This photo has no location.
            </Text>
            <Text size={1}>Drop a pin on the map below so this trip can show.</Text>
          </Stack>
        </Card>
      ) : null}
      {status === 'manual' && hasLocation ? (
        <Card padding={3} radius={2} tone="primary">
          <Text size={1}>Location set. Move the pin on the map if it is wrong.</Text>
        </Card>
      ) : null}
    </Stack>
  )
}
