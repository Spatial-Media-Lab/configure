// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// MIDI system connection and message handling.
class V2MIDI {
  // MIDI Note Number
  // The octave numbers -2 to 8 are not defined by MIDI itself, it's just what
  // some vendors of instruments and audio workstation software use. The middle
  // C (Number == 60) in this mapping is C3.
  static Note = Object.freeze({
    names: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],

    name: (note) => {
      const octave = Math.trunc(note / 12) - 2;
      return this.Note.names[note % 12] + octave;
    },

    isBlack: (note) => {
      return this.Note.names[note % 12].includes('♯');
    }
  });

  // MIDI Control Change (CC) values.
  static CC = Object.freeze({
    // MSB Controller Data.
    bankSelect: 0,
    modulationWheel: 1,
    breathController: 2,
    controller3: 3,
    footController: 4,
    portamentoTime: 5,
    dataEntry: 6,
    channelVolume: 7,
    balance: 8,
    controller9: 9,
    pan: 10,
    expression: 11,
    effectControl1: 12,
    effectControl2: 13,
    controller14: 14,
    controller15: 15,
    generalPurpose1: 16,
    generalPurpose2: 17,
    generalPurpose3: 18,
    generalPurpose4: 19,

    // LSB for controllers 0 to 31.
    controllerLSB: 32,
    bankSelectLSB: this.controllerLSB + this.bankSelect,
    modulationWheelLSB: this.controllerLSB + this.modulationWheel,
    breathControllerLSB: this.controllerLSB + this.breathController,
    controller3LSB: this.controllerLSB + this.controller3,
    footControllerLSB: this.controllerLSB + this.footController,
    portamentoTimeLSB: this.controllerLSB + this.portamentoTime,
    dataEntryLSB: this.controllerLSB + this.dataEntry,
    channelVolumeLSB: this.controllerLSB + this.channelVolume,
    balanceLSB: this.controllerLSB + this.balance,
    controller9LSB: this.controllerLSB + this.controller9,
    panLSB: this.controllerLSB + this.pan,
    expressionLSB: this.controllerLSB + this.expression,
    effectControl1LSB: this.controllerLSB + this.effectControl1,
    effectControl2LSB: this.controllerLSB + this.effectControl2,
    controller14LSB: this.controllerLSB + this.controller14,
    controller15LSB: this.controllerLSB + this.controller15,
    generalPurpose1LSB: this.controllerLSB + this.generalPurpose1,
    generalPurpose2LSB: this.controllerLSB + this.generalPurpose2,
    generalPurpose3LSB: this.controllerLSB + this.generalPurpose3,
    generalPurpose4LSB: this.controllerLSB + this.generalPurpose4,

    // Single-byte Controllers.
    sustain: 64,
    portamento: 65,
    sostenuto: 66,
    soft: 67,
    legato: 68,
    hold2: 69,
    soundController1: 70, // Sound Variation
    soundController2: 71, // Timber / Harmonic Intensity
    soundController3: 72, // Release Time
    soundController4: 73, // Attack Time
    soundController5: 74, // Brightness
    soundController6: 75, // Decay Time
    soundController7: 76, // Vibrato Rate
    soundController8: 77, // Vibrato Depth
    soundController9: 78, // Vibrato Delay
    soundController10: 79,
    generalPurpose5: 80, // Decay
    generalPurpose6: 81, // High Pass Filter Frequency
    generalPurpose7: 82,
    generalPurpose8: 83,
    portamentoControl: 84,
    controller85: 85,
    controller86: 86,
    controller87: 87,
    velocityPrefix: 88,
    controller89: 89,
    controller90: 90,
    effects1: 91, // Reverb Send
    effects2: 92, // Tremolo Depth
    effects3: 93, // Chorus Send
    effects4: 94, // Celeste Depth
    effects5: 95, // Phaser Depth

    // Increment/Decrement and Parameter numbers.
    dataIncrement: 96,
    dataDecrement: 97,
    NRPNLSB: 98,
    NRPNMSB: 99,
    RPNLSB: 100,
    RPNMSB: 101,

    controller102: 102,
    controller103: 103,
    controller104: 104,
    controller105: 105,
    controller106: 106,
    controller107: 107,
    controller108: 108,
    controller109: 109,
    controller110: 110,
    controller111: 111,
    controller112: 112,
    controller113: 113,
    controller114: 114,
    controller115: 115,
    controller116: 116,
    controller117: 117,
    controller118: 118,
    controller119: 119,

    // Channel Mode Message
    allSoundOff: 120,
    resetAllControllers: 121,
    localControl: 122,
    allNotesOff: 123,
    omniModeOff: 124,
    omniModeOn: 125,
    monoModeOn: 126,
    polyModeOn: 127,

    Name: Object.freeze({
      0: 'Bank Select',
      1: 'Modulation',
      2: 'Breath',
      4: 'Foot Control',
      5: 'Portamento Time',
      7: 'Volume',
      8: 'Balance',
      10: 'Pan',
      11: 'Expression',
      12: 'Effect 1',
      13: 'Effect 2',
      16: 'General 1',
      17: 'General 2',
      18: 'General 3',
      19: 'General 4',
      64: 'Sustain',
      65: 'Portamento',
      66: 'Sostenuto',
      67: 'Soft Pedal',
      68: 'Legato',
      69: 'Hold 2',
      70: 'Sound 1',
      71: 'Sound 2',
      72: 'Sound 3',
      73: 'Sound 4',
      74: 'Slide',
      75: 'Sound 6',
      76: 'Sound 7',
      77: 'Sound 8',
      78: 'Sound 9',
      79: 'Sound 10',
      80: 'General 5',
      81: 'General 6',
      82: 'General 7',
      83: 'General 8',
      84: 'Portamento Control',
      88: 'Velocity Prefix',
      91: 'Reverb',
      92: 'Tremolo',
      93: 'Chorus',
      94: 'Celeste Depth',
      95: 'Phaser Depth',
      120: 'Sound Off',
      121: 'Reset',
      122: 'Local',
      123: 'Notes Off'
    })
  });

  // The MIDI wire protocol's status byte definitions.The first byte of a
  // message, the only byte with the 7th bit set. The lower 4 bit are the
  // channel number or the system message type.
  static Status = Object.freeze({
    noteOff: 0x80 | (0 << 4),
    noteOn: 0x80 | (1 << 4),
    aftertouch: 0x80 | (2 << 4),
    controlChange: 0x80 | (3 << 4),
    programChange: 0x80 | (4 << 4),
    aftertouchChannel: 0x80 | (5 << 4),
    pitchBend: 0x80 | (6 << 4),
    system: 0x80 | (7 << 4),

    // The 'system' messages are device global, the channel number
    // indentifies the type of system message.
    systemExclusive: 0x80 | (7 << 4) | 0,
    systemTimeCodeQuarterFrame: 0x80 | (7 << 4) | 1,
    systemSongPosition: 0x80 | (7 << 4) | 2,
    systemSongSelect: 0x80 | (7 << 4) | 3,
    systemTuneRequest: 0x80 | (7 << 4) | 6,
    systemExclusiveEnd: 0x80 | (7 << 4) | 7,
    systemClock: 0x80 | (7 << 4) | 8,
    systemStart: 0x80 | (7 << 4) | 10,
    systemContinue: 0x80 | (7 << 4) | 11,
    systemStop: 0x80 | (7 << 4) | 12,
    systemActiveSensing: 0x80 | (7 << 4) | 14,
    systemReset: 0x80 | (7 << 4) | 15,

    getType: (status) => {
      // Remove channel number.
      if ((status & 0xf0) != this.Status.system)
        return status & 0xf0;

      // Return 'system' message type.
      return status;
    },

    getChannel: (status) => {
      return status & 0x0f;
    }
  });

  // The WebMIDI system context.
  #system = null;

  // Subscription to device connect/disconnect events.
  #notifiers = Object.seal({
    state: []
  });

  addNotifier(type, handler) {
    this.#notifiers[type].push(handler);
  }

  // Connect to the MIDI subsystem.
  setup(handler) {
    if (!navigator.requestMIDIAccess) {
      handler('This browser does not support WebMIDI');
      return;
    }

    navigator.requestMIDIAccess({
      sysex: true,
      software: false

    }).then((access) => {
      this.#system = access;

      // Subscribe to device connect/disconnect events.
      this.#system.onstatechange = () => {
        for (const notifier of this.#notifiers.state)
          notifier(event);
      };
      handler();

    }, () => {
      handler('Unable to access MIDI devices');
    });
  }

  // Combine input and output ports to a device.
  getDevices(type) {
    let devices = new Map();

    if (!this.#system)
      return devices;

    // Build list of all output ports.
    let outputPorts = new Map();
    for (const port of this.#system.outputs.values())
      outputPorts.set(port.id, port);

    for (const port of this.#system.inputs.values()) {
      const outputPort = this.#findOutputPort(port);

      // Remove the port we have found from the list, it is part of a pair.
      if (outputPort)
        outputPorts.delete(outputPort.id);

      else if (type == 'both' || type == 'output')
        continue;

      const id = port.id + (outputPort ? outputPort.id : '');
      devices.set(id, {
        name: port.name,
        id: id,
        in: port,
        out: outputPort
      });
    }

    if (type == 'both' || type == 'input')
      return devices;

    // Add the remaining output-only ports.
    for (const port of outputPorts.values())
      devices.set(port.id, {
        name: port.name,
        id: port.id,
        in: null,
        out: port
      });

    return devices;
  }

  // The operating systems and WebMIDI does not provide a reliable way to
  // connect the input and output ports of a device. Try to figure it
  // out by their port names and position/index in the device lists.
  #findOutputPort(input) {
    // Iterate the input ports with our name and return our position.
    let inputIdx = 0;
    for (const port of this.#system.inputs.values()) {
      if (port.name != input.name)
        continue;

      if (port == input)
        break;

      inputIdx++;
    }

    // Search output port with the same name.
    let outputIdx = 0;
    for (const port of this.#system.outputs.values()) {
      let name = port.name;

      // Windows names the ports *MIDIIN* and *MIDIOUT*.
      if (input.name.match(/^MIDIIN[1-9]/))
        name = name.replace(/^MIDIOUT/, 'MIDIIN');

      if (name != input.name)
        continue;

      // Found the same name at the same position.
      if (outputIdx == inputIdx)
        return port;

      outputIdx++;
    }
  }
}

// Device to hold MIDI ports and send and receives messages.
class V2MIDIDevice {
  input = null;
  output = null;

  #notifiers = Object.seal({
    note: [],
    noteOff: [],
    aftertouch: [],
    controlChange: [],
    aftertouchChannel: [],
    systemExclusive: []
  });

  addNotifier(type, handler) {
    this.#notifiers[type].push(handler);
  }

  disconnect() {
    if (this.input) {
      this.input.onmidimessage = null;
      this.input.close();
      this.input = null;
    }

    if (this.output) {
      this.output.close();
      this.output = null;
    }
  }

  // Incoming message.
  handleMessage(message) {
    const type = V2MIDI.Status.getType(message.data[0]);
    const channel = V2MIDI.Status.getChannel(message.data[0]);

    switch (type) {
      case V2MIDI.Status.noteOn: {
        const note = message.data[1];
        const velocity = message.data[2];
        for (const notifier of this.#notifiers.note)
          notifier(channel, note, velocity);
        break;
      }

      case V2MIDI.Status.noteOff: {
        const note = message.data[1];
        const velocity = message.data[2];
        for (const notifier of this.#notifiers.noteOff)
          notifier(channel, note, velocity);
        break;
      }

      case V2MIDI.Status.aftertouch: {
        const note = message.data[1];
        const pressure = message.data[2];
        for (const notifier of this.#notifiers.aftertouch)
          notifier(channel, note, pressure);

        break;
      }

      case V2MIDI.Status.controlChange: {
        const controller = message.data[1];
        const value = message.data[2];
        for (const notifier of this.#notifiers.controlChange)
          notifier(channel, controller, value);
        break;
      }

      case V2MIDI.Status.aftertouchChannel: {
        const value = message.data[1];
        for (const notifier of this.#notifiers.aftertouchChannel)
          notifier(channel, value);
        break;
      }

      case V2MIDI.Status.systemExclusive:
        // 0x7d == MIDI private/research ID.
        if (message.data[1] != 0x7d)
          return;

        // We are only interested in JSON objects.
        if (message.data[2] != '{'.charCodeAt() || message.data[message.data.length - 2] != '}'.charCodeAt())
          return;

        for (const notifier of this.#notifiers.systemExclusive)
          notifier(message.data.slice(2, -1));
        break;
    }
  }

  // Outgoing messages.
  sendNote(channel, note, velocity) {
    if (!this.output)
      return;

    this.output.send([V2MIDI.Status.noteOn | channel, note, velocity]);
  }

  sendNoteOff(channel, note, velocity) {
    if (!this.output)
      return;

    if (velocity == null)
      velocity = 64;
    this.output.send([V2MIDI.Status.noteOff | channel, note, velocity]);
  }

  sendControlChange(channel, controller, value) {
    if (!this.output)
      return;

    this.output.send([V2MIDI.Status.controlChange | channel, controller, value]);
  }

  sendProgramChange(channel, value) {
    if (!this.output)
      return;

    this.output.send([V2MIDI.Status.programChange | channel, value]);
  }

  sendAftertouchChannel(channel, value) {
    if (!this.output)
      return;

    this.output.send([V2MIDI.Status.aftertouchChannel | channel, value]);
  }

  sendPitchBend(channel, value) {
    if (!this.output)
      return;

    const bits = value + 8192;
    const msb = (bits >> 7) & 0x7f;
    const lsb = bits & 0x7f;
    this.output.send([V2MIDI.Status.pitchBend | channel, lsb, msb]);
  }

  sendSystemReset() {
    if (!this.output)
      return;

    this.output.send([V2MIDI.Status.systemReset]);
  }

  sendSystemExclusive(message) {
    if (!this.output)
      return;

    // 0x7d == MIDI private/research ID.
    const sysex = [V2MIDI.Status.systemExclusive, 0x7d];

    // Escape unicode characters to fit into a 7 bit byte stream.
    const json = JSON.stringify(message).replace(/[\u007f-\uffff]/g, (c) => {
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });

    for (let i = 0; i < json.length; i++)
      sysex.push(json.charCodeAt(i));

    sysex.push(V2MIDI.Status.systemExclusiveEnd);
    this.output.send(sysex);
    return sysex.length;
  }
}
