'use client'

import {useEffect, useState} from 'react'
import {Switch} from '@sanity/ui'
import {PatchEvent, set, unset, useClient, useFormValue, type BooleanInputProps} from 'sanity'
import {effectiveDrone, isDroneFileName} from '../../lib/drone'

type ImageValue = {asset?: {_ref: string}}

/**
 * The "Drone photo" switch. Off unless the photo's file name says drone (DJI_…), in which case it
 * starts on. Flip it to override; flip it back to match the file name and it returns to automatic.
 */
export function DroneInput(props: BooleanInputProps) {
  const {value, onChange, readOnly} = props
  const client = useClient({apiVersion: '2026-01-01'})
  const image = useFormValue(['image']) as ImageValue | undefined
  const assetRef = image?.asset?._ref
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (!assetRef) {
      setFileName(null)
      return
    }
    let cancelled = false
    client
      .fetch<string | null>(`*[_id == $id][0].originalFilename`, {id: assetRef})
      .then((name) => !cancelled && setFileName(name ?? null))
      .catch(() => !cancelled && setFileName(null))
    return () => {
      cancelled = true
    }
  }, [assetRef, client])

  const auto = isDroneFileName(fileName)
  const on = effectiveDrone(value, fileName)

  return (
    <Switch
      checked={on}
      disabled={readOnly}
      onChange={() => {
        const next = !on
        // Matching the file name means "automatic", so don't store anything.
        onChange(PatchEvent.from(next === auto ? unset() : set(next)))
      }}
    />
  )
}
