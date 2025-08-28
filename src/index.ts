import { asyncIterableSequencer, Chain } from "async-iterable-sequencer";

export interface DelegateStreamOptions<I, O> {
  start?: (chain: Chain<O>) => void;
  transform: (chunk: I, chain: Chain<O>) => void;
  finish?: (chain: Chain<O>) => void;
}

export class DelegateStream<I, O> {
  public readable: ReadableStream<O>;
  public writable: WritableStream<I>;

  constructor({ start, transform, finish }: DelegateStreamOptions<I, O>) {
    const { sequence, chain } = asyncIterableSequencer<O>();
    this.readable = ReadableStream.from<O>(sequence);
    this.writable = new WritableStream<I>({
      write: (chunk) => {
        transform(chunk, chain);
      },
      close: () => {
        finish?.(chain);
      },
    });
    start?.(chain);
  }
}
