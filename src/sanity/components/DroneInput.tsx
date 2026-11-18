'use client'

import {useEffect, useState} from 'react'
import {Button, Flex, Stack, Switch, Text} from '@sanity/ui'
import {PatchEvent, set, unset, useClient, useFormValue, type BooleanInputProps} from 'sanity'
import {effectiveDrone, isDroneFileName} from '../../lib/drone'

type ImageValue = {asset?: {_ref: string}}

/**
 * The "Drone photo" switch. It shows what the site will do: on when the file name says
 * drone, off otherwise. Flip it to override (say, for a screenshot of a drone photo);
 * flip it back to match the file name and it returns to automatic.
 */
export function DroneInput(props: BooleanInputProps) {
  const {value, onChange, readOnly} = props
  const client = useClient({apiVersion: '2026-01-01'})
  const image = useFormValue(['image']) as ImageValue | undefined
  const assetRef = image?.asset?._ref
  // undefined while loading, null when there's no photo or no file name
  const [fileName, setFileName] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!assetRef) {
      setFileName(null)
      return
    }
    let cancelled = false
    setFileName(undefined)
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
  const setByHand = typeof value === 'boolean'

  const toggle = () => {
    const next = !on
    // Matching the file name means "automatic", so don't store anything.
    onChange(PatchEvent.from(next === auto ? unset() : set(next)))
  }

  let note: string
  if (fileName === undefined) note = 'Checking the file name…'
  else if (!assetRef) note = 'Add a photo first. Drone photos are spotted from the file name.'
  else if (setByHand && on && !auto) note = 'Marked as a drone photo by hand.'
  else if (setByHand && !on && auto) note = `Marked as not a drone photo by hand (the file name, ${fileName}, says drone).`
  else if (setByHand) note = 'Set by hand.'
  else if (auto) note = `Detected automatically from the file name (${fileName}).`
  else note = `Not detected from the file name${fileName ? ` (${fileName})` : ''}. Switch on if it was shot with a drone.`

  return (
    <Stack gap={3}>
      <Flex align="center" gap={3}>
        <Switch checked={on} onChange={toggle} disabled={readOnly} />
        <Text weight="medium">{on ? 'Drone photo' : 'Not a drone photo'}</Text>
      </Flex>
      <Flex align="center" gap={2} wrap="wrap">
        <Text size={1} muted>
          {note}
        </Text>
        {setByHand && !readOnly ? (
          <Button
            mode="bleed"
            fontSize={1}
            padding={1}
            text="Reset to automatic"
            onClick={() => onChange(PatchEvent.from(unset()))}
          />
        ) : null}
      </Flex>
    </Stack>
  )
}
