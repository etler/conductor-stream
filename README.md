# conductor-stream

A Transform Stream interface implementation that allows for dynamically injecting streams by chaining entire streams as well as any async iterable.

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
      controller.enqueue(text);
      controller.close();
    },
  });
}

function createUpperCaseTransform() {
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      controller.enqueue(chunk.toUpperCase());
    },
  });
}

createStringStream("This is a {{stream}} with {{injected}} content").pipeThrough(injectStream);
// Output: "This is a STREAM with INJECTED content"
```

## API Reference

### Exports

#### `ConductorStream`

The `ConductorStream` class is responsible for emitting chunks through `readable` by chaining async iterables together to be flattened and read. The class implements the `TransformStream` interface and may be used in `pipeThrough` calls as well as any other interface that accepts a `TransformStream` interface.

```typescript
class ConductorStream<I, O> {
  public readable: ReadableStream<O>;
  public writable: WritableStream<I>;
  constructor(options: ConductorStreamOptions<I, O>)
}
```

### Types

##### `ConductorStreamOptions`

```typescript
interface ConductorStreamOptions<I, O> {
  start?: (chain: Chain<O>) => void;
  transform: (chunk: I, chain: Chain<O>) => void;
  finish?: (chain: Chain<O>) => void;
}
```

##### `ConductorStreamOptions.start`

Triggers when the stream is initialized to allow for chaining async iterables on startup.

##### `ConductorStreamOptions.transform`

Triggered when chunks are written to the inbound `WritableStream` and allows for chaining async iterables based on the incoming data recieved.

##### `ConductorStreamOptions.finish`

Triggers when the inbound `WritableStream` is closed to allow for cleanup and closing of the chain.

#### `Chain`

Function signature for chain function. Chains an iterable to the sequencer. `null` must be passed to signal the end of input and end the sequence chain and close the outbound writable stream.

## License

[MIT][license] © [Tim Etler][author]

[license]: LICENSE.md
[author]: https://github.com/etler
