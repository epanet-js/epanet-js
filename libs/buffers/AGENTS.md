# @epanet-js/buffers

Domain-free primitives for packing data into flat binary buffers so it can cross
a worker boundary cheaply.

- `buffers.ts` — `createBuffer`, fixed- and variable-stride builders and views,
  and the scalar encode/decode helpers plus `DataSize`.
- `geo-buffer.ts` — `GeoIndexBuilder`, producing a Flatbush spatial index.
- `id-mapper.ts` — `IdMapper`, assigning dense contiguous indices to sparse ids.

This package knows nothing about what is being encoded and must stay that way.
It depends only on turf, flatbush and geojson types. Do not introduce domain
types, and do not document consumer-specific policy here — that belongs with the
consumer.

## `createBuffer` and buffer type

`createBuffer(size, bufferType)` returns a `SharedArrayBuffer` for `"shared"` and
an `ArrayBuffer` otherwise.

`SharedArrayBuffer` is only available on a **cross-origin isolated** page, which
requires the host to serve `Cross-Origin-Opener-Policy: same-origin` alongside
`Cross-Origin-Embedder-Policy: require-corp`. Isolation has consequences for
third-party embeds, so whether a consumer may use it is the consumer's decision —
check the consuming app's guidelines before reaching for `"shared"`.

An `ArrayBuffer` is transferable, so ownership can be moved to a worker in O(1)
instead of being copied. Transferring **neuters** the buffer on the sending side:
re-encode if the sender still needs the data.

## Write-mode contract

Builders accept entries two ways, and the choice is part of the buffer's
contract:

- `add(value)` — appends at the next sequential slot.
- `addAtIndex(index, value)` — writes at a caller-chosen slot.

When two buffers are meant to be read at the same index — one written
sequentially and the other positionally — they align **only** if the indices
supplied are dense and ascending from zero. Skipping entries in one and not the
other silently misaligns them, and nothing detects it at runtime.

If you need to omit entries, either omit them from both buffers and renumber
densely, or write placeholders so positions are preserved. Do not mix the two
strategies.

## Sizing variable-size buffers

`VariableSizeBufferBuilder` is constructed with a precomputed total size. That
total must be derived with the **same** logic used when writing, or the buffer is
wrong: over-sizing merely wastes bytes, under-sizing corrupts the payload. Keep
the sizing pass and the writing pass in one place, or drive both from the same
helper.
