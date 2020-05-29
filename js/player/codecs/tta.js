/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
    let FORMAT_SIMPLE = undefined;
    let FORMAT_ENCRYPTED = undefined;
    let MAX_ORDER = undefined;
    let ttafilter_configs = undefined;
    let shift_1 = undefined;
    let shift_16 = undefined;
    let ttafilter_init = undefined;
    let rice_init = undefined;
    let tta_get_unary = undefined;
    let memshl = undefined;
    let ttafilter_process = undefined;
    class TTADecoder extends AV.Decoder {
        constructor(...args) {
            super(...args);
            this.readChunk = this.readChunk.bind(this);
        }

        static initClass() {
            AV.Decoder.register('tta', TTADecoder);

            FORMAT_SIMPLE = 1;
            FORMAT_ENCRYPTED = 2;
            MAX_ORDER = 16;
            ttafilter_configs = [
                [10, 1],
                [ 9, 1],
                [10, 1],
                [12, 0]
            ];

            shift_1 = new Uint32Array([
                0x00000001, 0x00000002, 0x00000004, 0x00000008,
                0x00000010, 0x00000020, 0x00000040, 0x00000080,
                0x00000100, 0x00000200, 0x00000400, 0x00000800,
                0x00001000, 0x00002000, 0x00004000, 0x00008000,
                0x00010000, 0x00020000, 0x00040000, 0x00080000,
                0x00100000, 0x00200000, 0x00400000, 0x00800000,
                0x01000000, 0x02000000, 0x04000000, 0x08000000,
                0x10000000, 0x20000000, 0x40000000, 0x80000000,
                0x80000000, 0x80000000, 0x80000000, 0x80000000,
                0x80000000, 0x80000000, 0x80000000, 0x80000000
            ]);

            shift_16 = shift_1.subarray(4);

            ttafilter_init = function(channel, config) {
                var [shift, mode] = Array.from(config);
                return channel.filter = {
                    shift,
                    round: shift_1[shift - 1],
                    mode,
                    error: 0,
                    qm: new Int32Array(MAX_ORDER),
                    dx: new Int32Array(MAX_ORDER),
                    dl: new Int32Array(MAX_ORDER)
                };
            };

            rice_init = (channel, k0, k1) =>
                channel.rice = {
                    k0,
                    k1,
                    sum0: shift_16[k0],
                    sum1: shift_16[k1]
                }
            ;

            tta_get_unary = function(bitstream) {
                let ret = 0;

                // count ones
                while (true) {
                    if(!bitstream.available(1)){
                      throw new AV.UnderflowError();
                    }
                    if(!bitstream.readLSB(1)){
                      break;
                    }
                    ret++;
                }

                return ret;
            };

            memshl = function(a) {
                let i = 0;
                let b = 1;
                a[i++] = a[b++];
                a[i++] = a[b++];
                a[i++] = a[b++];
                a[i++] = a[b++];
                a[i++] = a[b++];
                a[i++] = a[b++];
                a[i++] = a[b++];
                return a[i++] = a[b++];
            };

            ttafilter_process = function(c, p) {
                let dx_i, qm_i;
                let {dl, qm, dx, round:sum} = c;
                let dl_i = (qm_i = (dx_i = 0));

                if (!c.error) {
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    sum += dl[dl_i++] * qm[qm_i++];
                    dx_i += 8;

                } else if (c.error < 0) {
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] -= dx[dx_i++]);

                } else {
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                    sum += dl[dl_i++] * (qm[qm_i++] += dx[dx_i++]);
                }

                dx[dx_i - 0] = ((dl[dl_i - 1] >> 30) | 1) << 2;
                dx[dx_i - 1] = ((dl[dl_i - 2] >> 30) | 1) << 1;
                dx[dx_i - 2] = ((dl[dl_i - 3] >> 30) | 1) << 1;
                dx[dx_i - 3] = ((dl[dl_i - 4] >> 30) | 1);

                // mode == 0
                c.error = p;
                p += (sum >> c.shift);
                dl[dl_i] = p;

                if (c.mode) {
                    dl[dl_i - 1] = dl[dl_i - 0] - dl[dl_i - 1];
                    dl[dl_i - 2] = dl[dl_i - 1] - dl[dl_i - 2];
                    dl[dl_i - 3] = dl[dl_i - 2] - dl[dl_i - 3];
                }

                memshl(dl);
                memshl(dx);

                return p;
            };
        }

        init() {
            var frameLen = (256 * this.format.sampleRate) / 245;
            var dataLen = this.format.sampleCount;
            this.lastFrameLength = dataLen % frameLen;
            this.frames = Math.floor(dataLen / frameLen) + (this.lastFrameLength > 0 ? 1 : 0);
        }

        readChunk() {
          try{
            let i;
            let end;
            let end2;
            let end3;
            let frameLen = (256 * this.format.sampleRate) / 245;
            var numChannels = this.format.channelsPerFrame;
            var bps = ((this.format.bitsPerChannel + 7) / 8) | 0;
            var stream = this.bitstream;

            if ((--this.frames === 0) && (this.lastFrameLength > 0)) {
                frameLen = this.lastFrameLength;
            }

            var start = stream.offset();
            var decode_buffer = new Int32Array(frameLen * numChannels);

            // init per channel states
            var channels = [];
            for (i = 0, end = numChannels; i < end; i++) {
                channels[i] = {
                    predictor: 0,
                    rice: {
                        k0: 10,
                        k1: 10,
                        sum0: shift_16[10],
                        sum1: shift_16[10]
                    }
                };

                ttafilter_init(channels[i], ttafilter_configs[bps - 1]);
            }

            let cur_chan = 0;
            for (let p = 0, end1 = frameLen * numChannels; p < end1; p++) {
                var depth, k, value;
                var {predictor, filter, rice} = channels[cur_chan];
                let unary = tta_get_unary(stream);

                if (unary === 0) {
                    depth = 0;
                    k = rice.k0;
                } else {
                    depth = 1;
                    k = rice.k1;
                    unary--;
                }

                if (!stream.available(k)) {
                    throw new AV.UnderflowError();
                }

                if (k) {
                    value = (unary << k) + stream.readLSB(k);
                } else {
                    value = unary;
                }

                if (depth === 1) {
                    rice.sum1 += value - (rice.sum1 >>> 4);

                    if ((rice.k1 > 0) && (rice.sum1 < shift_16[rice.k1])) {
                        rice.k1--;
                    } else if (rice.sum1 > shift_16[rice.k1 + 1]) {
                        rice.k1++;
                    }

                    value += shift_1[rice.k0];
                }

                rice.sum0 += value - (rice.sum0 >>> 4);

                if ((rice.k0 > 0) && (rice.sum0 < shift_16[rice.k0])) {
                    rice.k0--;
                } else if (rice.sum0 > shift_16[rice.k0 + 1]) {
                    rice.k0++;
                }

                // extract coded value
                decode_buffer[p] = value & 1 ? ++value >> 1 : -value >> 1;

                // run hybrid filter
                decode_buffer[p] = ttafilter_process(filter, decode_buffer[p]);

                // fixed order prediction
                switch (bps) {
                    case 1:
                        decode_buffer[p] += ((predictor << 4) - predictor) >> 4;
                        break;
                    case 2: case 3:
                        decode_buffer[p] += ((predictor << 5) - predictor) >> 5;
                        break;
                    case 4:
                        decode_buffer[p] += predictor;
                        break;
                }

                channels[cur_chan].predictor = decode_buffer[p];

                // flip channels
                if (cur_chan < (numChannels - 1)) {
                    cur_chan++;
                } else {
                    // decorrelate in case of stereo integer
                    if (numChannels > 1) {
                        let r = p - 1;
                        decode_buffer[p] += (decode_buffer[r] / 2) | 0;

                        while (r > (p - numChannels)) {
                            decode_buffer[r] = decode_buffer[r + 1] - decode_buffer[r];
                            r--;
                        }
                    }

                    cur_chan = 0;
                }
            }

            if (!stream.available(32)) {
                throw new AV.UnderflowError();
            }
            stream.advance(32); // skip frame crc
            stream.align();

            switch (bps) {
                case 1:
                    for (i = 0, end2 = decode_buffer.length; i < end2; i++) {
                        decode_buffer[i] += 0x80;
                    }
                    break;

                case 3:
                    for (i = 0, end3 = decode_buffer.length; i < end3; i++) {
                        decode_buffer[i] <<= 8;
                    }
                    break;
            }
        }catch(e){
          this.frames++;
          throw e;
        }

        return decode_buffer;
      }
    };
    TTADecoder.initClass();
/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class TTADemuxer extends AV.Demuxer {
    static initClass() {
        AV.Demuxer.register(TTADemuxer);
    }

    static probe(buffer) {
        return buffer.peekString(0, 4) === 'TTA1';
    }

    readChunk() {
        if (!this.readHeader && this.stream.available(22)) {
            if (this.stream.readString(4) !== 'TTA1') {
                return this.emit('error', 'Invalid TTA file.');
            }

            this.flags = this.stream.readUInt16(true); // little endian
            this.format = {
                formatID: 'tta',
                channelsPerFrame: this.stream.readUInt16(true),
                bitsPerChannel: this.stream.readUInt16(true),
                sampleRate: this.stream.readUInt32(true),
                sampleCount: this.stream.readUInt32(true)
            };

            this.emit('format', this.format);
            this.emit('duration', ((this.format.sampleCount / this.format.sampleRate) * 1000) | 0);

            this.stream.advance(4); // skip CRC32 footer
            this.readHeader = true;
        }

        if (this.readHeader && !this.readSeekTable) {
            var framelen = (256 * this.format.sampleRate) / 245;
            var datalen = this.format.sampleCount;
            var totalFrames = Math.floor(datalen / framelen) + (datalen % framelen ? 1 : 0);
            var seekTableSize = totalFrames * 4;

            if (!this.stream.available(seekTableSize + 4)) { return; }

            this.stream.advance(seekTableSize);
            this.stream.advance(4); // seektable csc

            this.readSeekTable = true;
        }

        if (this.readSeekTable) {
            while (this.stream.available(1)) {
                var buf = this.stream.readSingleBuffer(this.stream.remainingBytes());
                this.emit('data', buf, this.stream.remainingBytes() === 0);
            }
        }

    }
}
TTADemuxer.initClass();
