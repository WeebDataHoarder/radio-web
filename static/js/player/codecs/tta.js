(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var TTADecoder,
  boundMethodCheck = function(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new Error('Bound instance method accessed before binding'); } };

TTADecoder = (function() {
  var FORMAT_ENCRYPTED, FORMAT_SIMPLE, MAX_ORDER, memshl, rice_init, shift_1, shift_16, tta_get_unary, ttafilter_configs, ttafilter_init, ttafilter_process;

  class TTADecoder extends AV.Decoder {
    constructor() {
      super(...arguments);
      this.readChunk = this.readChunk.bind(this);
    }

    init() {
      var dataLen, frameLen;
      frameLen = 256 * this.format.sampleRate / 245;
      dataLen = this.format.sampleCount;
      this.lastFrameLength = dataLen % frameLen;
      return this.frames = Math.floor(dataLen / frameLen) + (this.lastFrameLength > 0 ? 1 : 0);
    }

    readChunk() {
      var bps, channels, cur_chan, decode_buffer, depth, filter, frameLen, i, j, k, l, m, n, numChannels, p, predictor, r, ref, ref1, ref2, ref3, rice, start, stream, unary, value;
      boundMethodCheck(this, TTADecoder);
      frameLen = 256 * this.format.sampleRate / 245;
      numChannels = this.format.channelsPerFrame;
      bps = (this.format.bitsPerChannel + 7) / 8 | 0;
      stream = this.bitstream;
      if (--this.frames === 0 && this.lastFrameLength > 0) {
        frameLen = this.lastFrameLength;
      }
      start = stream.offset();
      decode_buffer = new Int32Array(frameLen * numChannels);
      
      // init per channel states
      channels = [];
      for (i = j = 0, ref = numChannels; j < ref; i = j += 1) {
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
      cur_chan = 0;
      for (p = l = 0, ref1 = frameLen * numChannels; l < ref1; p = l += 1) {
        ({predictor, filter, rice} = channels[cur_chan]);
        unary = tta_get_unary(stream);
        if (unary === 0) {
          depth = 0;
          k = rice.k0;
        } else {
          depth = 1;
          k = rice.k1;
          unary--;
        }
        if (!stream.available(k)) {
          // whoa, buffer overrun! back it up...
          stream.advance(start - stream.offset());
          this.frames++;
          return this.once('available', this.readChunk);
        }
        if (k) {
          value = (unary << k) + stream.readLSB(k);
        } else {
          value = unary;
        }
        if (depth === 1) {
          rice.sum1 += value - (rice.sum1 >>> 4);
          if (rice.k1 > 0 && rice.sum1 < shift_16[rice.k1]) {
            rice.k1--;
          } else if (rice.sum1 > shift_16[rice.k1 + 1]) {
            rice.k1++;
          }
          value += shift_1[rice.k0];
        }
        rice.sum0 += value - (rice.sum0 >>> 4);
        if (rice.k0 > 0 && rice.sum0 < shift_16[rice.k0]) {
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
          case 2:
          case 3:
            decode_buffer[p] += ((predictor << 5) - predictor) >> 5;
            break;
          case 4:
            decode_buffer[p] += predictor;
        }
        channels[cur_chan].predictor = decode_buffer[p];
        
        // flip channels
        if (cur_chan < numChannels - 1) {
          cur_chan++;
        } else {
          // decorrelate in case of stereo integer
          if (numChannels > 1) {
            r = p - 1;
            decode_buffer[p] += decode_buffer[r] / 2 | 0;
            while (r > p - numChannels) {
              decode_buffer[r] = decode_buffer[r + 1] - decode_buffer[r];
              r--;
            }
          }
          cur_chan = 0;
        }
      }
      stream.advance(32); // skip frame crc
      stream.align();
      switch (bps) {
        case 1:
          for (i = m = 0, ref2 = decode_buffer.length; m < ref2; i = m += 1) {
            decode_buffer[i] += 0x80;
          }
          break;
        case 3:
          for (i = n = 0, ref3 = decode_buffer.length; n < ref3; i = n += 1) {
            decode_buffer[i] <<= 8;
          }
      }
      return this.emit('data', decode_buffer);
    }

  };

  AV.Decoder.register('tta', TTADecoder);

  FORMAT_SIMPLE = 1;

  FORMAT_ENCRYPTED = 2;

  MAX_ORDER = 16;

  ttafilter_configs = [[10, 1], [9, 1], [10, 1], [12, 0]];

  shift_1 = new Uint32Array([0x00000001, 0x00000002, 0x00000004, 0x00000008, 0x00000010, 0x00000020, 0x00000040, 0x00000080, 0x00000100, 0x00000200, 0x00000400, 0x00000800, 0x00001000, 0x00002000, 0x00004000, 0x00008000, 0x00010000, 0x00020000, 0x00040000, 0x00080000, 0x00100000, 0x00200000, 0x00400000, 0x00800000, 0x01000000, 0x02000000, 0x04000000, 0x08000000, 0x10000000, 0x20000000, 0x40000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000, 0x80000000]);

  shift_16 = shift_1.subarray(4);

  ttafilter_init = function(channel, config) {
    var mode, shift;
    [shift, mode] = config;
    return channel.filter = {
      shift: shift,
      round: shift_1[shift - 1],
      mode: mode,
      error: 0,
      qm: new Int32Array(MAX_ORDER),
      dx: new Int32Array(MAX_ORDER),
      dl: new Int32Array(MAX_ORDER)
    };
  };

  rice_init = function(channel, k0, k1) {
    return channel.rice = {
      k0: k0,
      k1: k1,
      sum0: shift_16[k0],
      sum1: shift_16[k1]
    };
  };

  tta_get_unary = function(bitstream) {
    var ret;
    ret = 0;
    
      // count ones
    while (bitstream.available(1) && bitstream.readLSB(1)) {
      ret++;
    }
    return ret;
  };

  memshl = function(a) {
    var b, i;
    i = 0;
    b = 1;
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
    var dl, dl_i, dx, dx_i, qm, qm_i, sum;
    ({
      dl,
      qm,
      dx,
      round: sum
    } = c);
    dl_i = qm_i = dx_i = 0;
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
    dx[dx_i - 3] = (dl[dl_i - 4] >> 30) | 1;
    
    // mode == 0
    c.error = p;
    p += sum >> c.shift;
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

  return TTADecoder;

}).call(this);


},{}],2:[function(require,module,exports){
var TTADemuxer;

TTADemuxer = (function() {
  class TTADemuxer extends AV.Demuxer {
    static probe(buffer) {
      return buffer.peekString(0, 4) === 'TTA1';
    }

    readChunk() {
      var buf, datalen, framelen, seekTableSize, totalFrames;
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
        this.emit('duration', this.format.sampleCount / this.format.sampleRate * 1000 | 0);
        this.stream.advance(4); // skip CRC32 footer
        this.readHeader = true;
      }
      if (this.readHeader && !this.readSeekTable) {
        framelen = 256 * this.format.sampleRate / 245;
        datalen = this.format.sampleCount;
        totalFrames = Math.floor(datalen / framelen) + (datalen % framelen ? 1 : 0);
        seekTableSize = totalFrames * 4;
        if (!this.stream.available(seekTableSize + 4)) {
          return;
        }
        this.stream.advance(seekTableSize);
        this.stream.advance(4); // seektable csc
        this.readSeekTable = true;
      }
      if (this.readSeekTable) {
        while (this.stream.available(1)) {
          buf = this.stream.readSingleBuffer(this.stream.remainingBytes());
          this.emit('data', buf, this.stream.remainingBytes() === 0);
        }
      }
    }

  };

  AV.Demuxer.register(TTADemuxer);

  return TTADemuxer;

}).call(this);


},{}],3:[function(require,module,exports){
require("./src/demuxer");

require("./src/decoder");


},{"./src/decoder":1,"./src/demuxer":2}]},{},[3]);
