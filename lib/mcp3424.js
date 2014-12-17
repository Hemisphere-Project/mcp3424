var MCP3424, MCP342X_12_BIT, MCP342X_14_BIT, MCP342X_16_BIT, MCP342X_18_BIT, MCP342X_BUSY, MCP342X_CHANNEL_1, MCP342X_CHANNEL_2, MCP342X_CHANNEL_3, MCP342X_CHANNEL_4, MCP342X_CHAN_FIELD, MCP342X_CONTINUOUS, MCP342X_GAIN_FIELD, MCP342X_GAIN_X1, MCP342X_GAIN_X2, MCP342X_GAIN_X4, MCP342X_GAIN_X8, MCP342X_RES_FIELD, MCP342X_RES_SHIFT, MCP342X_START, Wire;

Wire = require('i2c');

MCP342X_GAIN_FIELD = 0x03;

MCP342X_GAIN_X1 = 0x00;

MCP342X_GAIN_X2 = 0x01;

MCP342X_GAIN_X4 = 0x02;

MCP342X_GAIN_X8 = 0x03;

MCP342X_RES_FIELD = 0x0C;

MCP342X_RES_SHIFT = 2;

MCP342X_12_BIT = 0x00;

MCP342X_14_BIT = 0x04;

MCP342X_16_BIT = 0x08;

MCP342X_18_BIT = 0x0C;

MCP342X_CONTINUOUS = 0x10;

MCP342X_CHAN_FIELD = 0x60;

MCP342X_CHANNEL_1 = 0x00;

MCP342X_CHANNEL_2 = 0x20;

MCP342X_CHANNEL_3 = 0x40;

MCP342X_CHANNEL_4 = 0x60;

MCP342X_START = 0x80;

MCP342X_BUSY = 0x80;

// Resistors divider ratio (R20+R21)/R21 required to scale back input voltage -
// see {https://raw.github.com/hugokernel/RaspiOMix/master/export/1.0.1/images/schema.png Schematic}
// All ratios yield a 0v-5.06v range
// @note Ratio for 4k7 / 10k : 3.3
// @note Ratio for 6k8 / 10k : 2.471
DIVIDER_RATIO = 2.471

// LSB in µV (cf datasheet table 4-1 p15)
//12bits : 1000
//14bits : 250
//16bits : 62.5
//18bits : 15.625
LSB = [1000,250,62.5,15.625]



MCP3424 = (function() {
  MCP3424.prototype.address = 0x0;

  MCP3424.prototype.gain = 0x0;

  MCP3424.prototype.res = 0x0;

  MCP3424.prototype.channel = [];

  MCP3424.prototype.currChannel = 0;

  MCP3424.prototype.oldChannel = 100;

  function MCP3424(address, gain, res, device) {
    this.address = address;
    this.gain = gain;
    this.res = res;
    this.device = device != null ? device : '/dev/i2c-1';
    this.wire = new Wire(this.address, {
      device: this.device
    });
    //this._readDataContiuously();
  }

  MCP3424.prototype.getMv = function(chan) {
    return this.channel[chan];
  };

  MCP3424.prototype._getMvDivisor = function() {
    var mvDivisor;
    return mvDivisor = 1 << (this.gain + 2 * this.res);
  };

  MCP3424.prototype._getAdcConfig = function(chan) {
    var adcConfig;
    adcConfig = MCP342X_CHANNEL_1 | MCP342X_CONTINUOUS;
    return adcConfig |= chan << 5 | this.res << 2 | this.gain;
  };

  MCP3424.prototype._changeChannel = function(chan) {
    var command;
    command = this._getAdcConfig(chan);
    return this.wire.writeByte(command, function(err) {
      if (err !== null) {
        return console.log(err);
      }
    });
  };

  MCP3424.prototype._readDataContiuously = function() {
    var self;
    self = this;
    return setInterval((function() {
      self._readData(self.currChannel);
    }), 10);
  };

  MCP3424.prototype._nextChannel = function() {
    this.currChannel++;
    if (this.currChannel === 4) {
      return this.currChannel = 0;
    }
  };

  MCP3424.prototype._readData = function(chan,callback) {
    var adcConfig, result, self, statusbyte;
    self = this;
    adcConfig = this._getAdcConfig(chan);
    result = 0;
    statusbyte = 0;
    this.wire.readBytes(adcConfig, 4, function(err, res) {
    	
    	//console.log(res);
    		
      var byte0, byte1, byte2;
      if (err !== null) {
        console.log(err);
      }
      if ((adcConfig & MCP342X_RES_FIELD) === MCP342X_18_BIT) {
        byte0 = res[0];
        byte1 = res[1];
        byte2 = res[2];
        statusbyte = res[3];
        result = byte2 | byte1 << 8 | byte0 << 16;
      } else {
        byte0 = res[0];
        byte1 = res[1];
        statusbyte = res[2];
        result = byte1 | byte0 << 8;
        
        //console.log(result*2.471*1000/1000000);
      }
      /*if ((statusbyte & MCP342X_BUSY) === 0) {
        self.channel[self.currChannel] = result / self._getMvDivisor();
        self._nextChannel();
        return self._changeChannel(self.currChannel);
      } else {
        return "err";
      }*/
      
      if(statusbyte & MCP342X_BUSY)
      	return callback("channel busy");
     
			// Sign is always first bit of first byte, whatever the resolution
			// (Cf datasheet p22, table 5-3)
			if(byte0 & 0x80)
					result *=-1;

			// We need the PGA factor, which is 2^PGA[gain]
			// and return voltage in volts
			// puts "DIVIDER_RATIO #{DIVIDER_RATIO} LSB[resolution] #{LSB[resolution]} output_code #{output_code} 2**PGA[gain] #{2**PGA[gain]}"
			return callback(null,DIVIDER_RATIO * LSB[self.res] * (result / Math.pow(2,self.gain) / 1000000));
    });
  };

  return MCP3424;

})();

module.exports = MCP3424;

