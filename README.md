# conductor-stream

A Transform Stream implementation that allows for dynamically injecting streams by chaining entire streams (or any async iterable).

## Installation

```bash
npm install conductor-stream
```

```bash
yarn add conductor-stream
```

## Usage

A complete example of using a conductor stream handler to parse for a template string and chain a sub stream.

```typescript
import { ConductorStream } from 'conductor-stream';

let buffer = "";

const conductorStream = new ConductorStream<string, string>({
  transform(chunk, chain) {
    const combined = buffer + chunk;
    const partialMatch = /(?<before>.*?)(?<partial>{{[^}]*)$/.exec(combined);

    let textToProcess;
    if (partialMatch) {
      const { before, partial } = partialMatch.groups ?? {};
      buffer = partial ?? "";
      textToProcess = before;
    } else {
      buffer = "";
      textToProcess = combined;
    }

    const conductorChunks =
      textToProcess !== undefined
        ? textToProcess
            .split(/({{.*?}})/)
            .filter((part) => part.length > 0)
            .map((part) => {
              const { content } = /^{{(?<content>.*)}}$/.exec(part)?.groups ?? {};
              return content !== undefined ? createStringStream(content).pipeThrough(createUpperCaseTransform()) : part;
            })
        : [];
    chain(conductorChunks.values());
  },
  finish(chain) {
    const result = buffer ? [buffer] : [];
    buffer = "";
    chain(result);
  },
});

function createStringStream(text: string) {
  return new ReadableStream<string>({
    start(controller) {
      controller.chain(text);
      controller.close();
    },
  });
}

function createUpperCaseTransform() {
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      controller.chain(chunk.toUpperCase());
    },
  });
}

createStringStream("This is a {{stream}} with {{injected}} content").pipeThrough(injectStream);
// Output: "This is a STREAM with INJECTED content"
```

## API Reference

### `ConductorStream`

The conductor stream class is responsible for emitting chunks through `readable` by chaining additional readable streams to be flattened and read. When a chunk is returned by the injection handler the conductor stream will immediately emit the chunk to the main stream. If a readable stream is received it will swap from the input stream and pipe the contents of the injected stream until the injected stream is complete. While injected streams are in progress, the input chunks of the original stream will continue to be sent to the inject handler. Any output from the inject handler pending after an injected stream will be buffered until the injected stream is complete, at which point the inject stream will then swap back to the output buffer until another injected stream is encountered.

Inject handlers are not blocked by injected streams and subsequent injected streams may be run in parallel and may also be another inject stream instance to allow for nested injected streams.

```typescript
class ConductorStream<I, O> {
  public readable: ReadableStream<O>;
  public writable: WritableStream<I>;
  constructor(options: ConductorStreamOptions<I, O>)
}
```

### `ConductorStreamOptions`

```typescript
interface ConductorStreamOptions<I, O> {
  start: (chain: AsyncIterable<O> | Iterable<O>) => void;
  transform: (chunk: I, chain: AsyncIterable<O> | Iterable<O>) => void;
  finish: (chain: AsyncIterable<O> | Iterable<O>) => void;
}
```

### `ConductorStreamOptions.start`

Triggers when the stream is closed to allow for flushing final chunks.

### `ConductorStreamOptions.transform`

Inject handlers take a chunk and return and iterable of the stream output type or readable streams of the stream output type. Chunks will be immediately emitted by the stream while the output of a readable stream will be piped as the stream output until they are complete. Chunks and streams will be emitted in the order they are provided until the iterable is exhausted.

### `ConductorStreamOptions.finish`

Triggers when the stream is closed to allow for flushing final chunks.
