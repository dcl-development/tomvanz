import LibRaw from '/vendor/libraw-wasm/index.js'

/** @param {MessageEvent<{id: string; buffer: ArrayBuffer}>} event */
self.onmessage = async (event) => {
  const {id, buffer} = event.data
  const raw = new LibRaw()
  try {
    await raw.open(new Uint8Array(buffer), {
      halfSize: false,
      outputBps: 8,
      useCameraWb: true,
    })
    const meta = await raw.metadata()
    const image = await raw.imageData()
    if (!meta || !image?.data) {
      self.postMessage({id, ok: false, error: 'decode_failed'})
      return
    }
    const payload = {
      id,
      ok: true,
      meta: {
        width: meta.width,
        height: meta.height,
        thumb_width: meta.thumb_width,
        thumb_height: meta.thumb_height,
      },
      image: {
        width: image.width,
        height: image.height,
        colors: image.colors,
        bits: image.bits,
        data: image.data,
      },
    }
    /** @type {Transferable[]} */
    const transfer = []
    if (image.data.buffer instanceof ArrayBuffer) {
      transfer.push(image.data.buffer)
    }
    self.postMessage(payload, transfer)
  } catch (error) {
    self.postMessage({id, ok: false, error: error instanceof Error ? error.message : String(error)})
  } finally {
    raw.dispose()
  }
}
