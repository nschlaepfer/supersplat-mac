import { AsyncBrotli, AsyncGZip } from 'fflate';

import { Writer } from './writer';

type LosslessMode = 'brotli' | 'gzip';

class LosslessCompressionWriter implements Writer {
    private compressor: AsyncBrotli | AsyncGZip;
    private chain: Promise<void> = Promise.resolve();
    private closed = false;

    constructor(private writer: Writer, mode: LosslessMode) {
        this.compressor = mode === 'brotli'
            ? new AsyncBrotli({ quality: 6 })
            : new AsyncGZip({ level: 9 });

        this.compressor.ondata = (chunk, final) => {
            this.chain = this.chain.then(async () => {
                await this.writer.write(chunk);
                if (final && !this.closed) {
                    this.closed = true;
                    await this.writer.close();
                }
            });
        };
    }

    write(data: Uint8Array) {
        this.compressor.push(data, false);
        return this.chain;
    }

    async close() {
        if (!this.closed) {
            this.compressor.push(new Uint8Array(0), true);
            await this.chain;
        }
    }
}

const wrapWithLosslessCompression = (writer: Writer, mode?: string) => {
    if (mode === 'brotli' || mode === 'gzip') {
        return new LosslessCompressionWriter(writer, mode);
    }
    return writer;
};

export { LosslessCompressionWriter, wrapWithLosslessCompression };
