import { DelegateStream } from "@/index";

describe("DelegateStream", () => {
  it("should chain a stream sequence in order without blocking the streams", async () => {
    let timeIndex = 0;
    let maxTime = 0;
    const timing: number[] = new Array<number>(10).fill(0).map(() => ++timeIndex);
    const inboundStream = new DelayStream(...timing);
    const delegator = new DelegateStream<number, number>({
      start: (chain) => {
        let timeIndex = 0;
        const timing: number[] = new Array<number>(10).fill(0).map(() => timeIndex++);
        chain(new DelayStream(...timing));
      },
      transform: (chunk, chain) => {
        let timeIndex = 0;
        const timing: number[] = new Array<number>(10).fill(0).map(() => chunk * 10 + timeIndex++);
        chain(new DelayStream(...timing));
        maxTime = timing.reduce((total, value) => total + value, 0);
      },
      finish: (chain) => {
        chain(null);
      },
    });
    const outboundStream = inboundStream.pipeThrough(delegator);
    let testIndex = 0;
    const startTime = Date.now();
    for await (const item of outboundStream) {
      expect(item).toEqual(testIndex++);
    }
    const totalTime = Date.now() - startTime;
    expect(totalTime / maxTime).toBeLessThan(1.1);
  });
});

async function* delayGenerator(...values: number[]) {
  for (const value of values) {
    yield new Promise<number>((resolve) =>
      setTimeout(() => {
        resolve(value);
      }, value),
    );
  }
}

class DelayStream extends ReadableStream<number> {
  constructor(...values: number[]) {
    const delayIterator = delayGenerator(...values);
    super({
      async start(controller) {
        for await (const value of delayIterator) {
          controller.enqueue(value);
        }
        controller.close();
      },
    });
  }
}
