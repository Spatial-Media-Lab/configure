// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2Device extends V2WebModule {
  #log = null;
  #midi = null;
  #bannerNotify = null;
  #select = null;
  #version = null;
  #device = null;
  #data = null;
  #tabs = null;
  #info = null;
  #details = null;
  #update = Object.seal({
    element: null,
    elementSelect: null,
    elementNewFirmware: null,
    elementUpload: null,
    elementProgress: null,
    notify: null,
    firmware: Object.seal({
      bytes: null,
      hash: null,
      current: null
    })
  });
  #timeout = null;
  #sequence = 0;
  #token = null;
  #notifiers = Object.seal({
    show: [],
    reset: []
  });

  constructor(log, connect) {
    super();
    this.#log = log;
    this.#midi = new V2MIDI();

    this.#bannerNotify = new V2WebNotify(this.canvas);

    this.#select = new V2MIDISelect(this.canvas, (e) => {
      e.classList.add('is-link');
    });

    this.#select.addNotifier('select', (device) => {
      if (device) {
        this.#log.attach();
        this.connect(device);

      } else {
        this.#log.detach();
        this.disconnect();
      }
    });

    // Focus the device selector when new devices arrive and we are
    // not currently connected.
    this.#select.addNotifier('add', () => {
      if (this.#device.input)
        return;

      this.#select.focus();
      window.scroll(0, 0);
    });

    this.#device = new V2MIDIDevice();
    this.#device.addNotifier('note', (channel, note, velocity) => {
      if (velocity > 0)
        this.print('Received <b>Note</b> <i>' +
          V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel <i>#' + (channel + 1)) + '</i>';

      else
        this.print('Received <b>NoteOff</b> <i>' +
          V2MIDI.Note.name(note) + '(' + note + ')</i> on channel #' + (channel + 1));
    });

    this.#device.addNotifier('noteOff', (channel, note, velocity) => {
      this.print('Received <b>NoteOff</b> <i>' +
        V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
    });

    this.#device.addNotifier('aftertouch', (channel, note, pressure) => {
      this.print('Received <b>Aftertouch</b> for note <i>' + V2MIDI.Note.name(note) + '(' + note + ')</i>' + ' with pressure <i>' + pressure + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.#device.addNotifier('controlChange', (channel, controller, value) => {
      this.print('Received <b>ControlChange</b> <i>' + controller +
        '</i> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.#device.addNotifier('aftertouchChannel', (pressure) => {
      this.print('Received <b>Aftertouch Channel</b> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
    });

    this.#device.addNotifier('systemExclusive', (message) => {
      this.printDevice('Received <b>SystemExclusive</b> length=' + message.length);

      const json = new TextDecoder().decode(message);
      let data;

      try {
        data = JSON.parse(json);

      } catch (error) {
        this.printDevice('Received unknown message format');
        return;
      }

      const device = data['com.versioduo.device'];
      if (!device) {
        this.printDevice('Received data for unknown interface');
        return;
      }

      if (this.#timeout) {
        clearTimeout(this.#timeout);
        this.#timeout = null;
      }

      this.#handleReply(device);
    });

    this.#midi.setup((error) => {
      if (error) {
        this.#log.print(error);
        this.#bannerNotify.error(error);
        return;
      }

      // Subscribe to device connect/disconnect events.
      this.#midi.addNotifier('state', (event) => {
        if (event) {
          if (event.port.type == 'input')
            this.#log.print('<b>' + event.port.name + '</b> (' + event.port.id + ':): Port is ' + event.port.state);

          else if (event.port.type == 'output')
            this.#log.print('<b>' + event.port.name + '</b> (:' + event.port.id + '): Port is ' + event.port.state);

          // Disconnect if the current device is unplugged.
          if (this.#device.input == event.port && event.port.state == 'disconnected')
            this.disconnect();
        }

        this.#select.update(this.#midi.getDevices('both'));
      });

      // Adding '?connect=<device name>' to the URL will try to connect to a device with the given name.
      if (connect) {
        this.#log.print('Found URL request to auto-connect to device: <b>' + connect + '</b>');

        const tryConnect = (device, portName = '') => {
          const name = connect + portName;
          if (name != device.name)
            return false;

          this.#log.print('Trying to connect to <b>' + name + '</b> ...');
          this.#select.update(this.#midi.getDevices('both'));
          this.#select.select(device);
          this.connect(device);
          return true;
        }

        for (const device of this.#midi.getDevices().values()) {
          if (tryConnect(device))
            break;

          // First MIDI port on MacOS.
          if (tryConnect(device, ' Port 1'))
            break;

          // First MIDI port on Linux.
          if (tryConnect(device, ' MIDI 1'))
            break;
        }
      }
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#version = e;
      e.classList.add('mt-4');
      e.classList.add('is-flex');
      e.classList.add('is-justify-content-end');
      e.innerHTML = '<a href="https://github.com/versioduo/configure" target="software">configure</a>, version ' + Number(document.querySelector('meta[name="version"]').content);
    });

    this.attach();
    return Object.seal(this);
  }

  addNotifier(type, handler) {
    this.#notifiers[type].push(handler);
  }

  print(line) {
    this.#log.print('<b>' + this.#device.getName() + '</b>: ' + line);
  }

  getData() {
    return this.#data;
  }

  getDevice() {
    return this.#device;
  }

  printDevice(line) {
    this.#log.print('<b>' + this.#device.getName() + '</b> (' + this.#device.getID() + '): ' + line);
  }

  // Print available MIDI ports. Their names might be different on different
  // operating systems.
  printStatus() {
    this.#log.print('configure, version <b>' + Number(document.querySelector('meta[name="version"]').content) + '</b>');

    for (const device of this.#midi.getDevices().values()) {
      let what = (device.in && device.in == this.#device.input) ? 'Connected to' : 'Found';
      if (device.in && device.out)
        this.#log.print(what + ' <b>' + device.in.name + '</b> (' + device.in.id + ':' + device.out.id + ')');

      else if (device.in)
        this.#log.print(what + ' <b>' + device.in.name + '</b> (' + device.in.id + ':)');

      else if (device.out)
        this.#log.print(what + ' <b>' + device.out.name + '</b> (:' + device.out.id + ')');
    }
  }

  sendJSON(json) {
    let request;
    try {
      request = JSON.parse(json);

    } catch (error) {
      this.printDevice('Unable to parse JSON string: <i>' + error.toString() + '</i>');
      return;
    }

    this.sendSystemExclusive(request);
  }

  sendRequest(request) {
    // Requests and replies contain the device's current bootID.
    if (this.#token)
      request.token = this.#token;

    this.sendSystemExclusive({
      'com.versioduo.device': request
    });
  }

  sendGetAll() {
    this.printDevice('Calling <b>getAll()</>');
    this.sendRequest({
      'method': 'getAll'
    });
    this.printDevice('Waiting for reply ...');
  }

  #disconnectDevice() {
    if (!this.#device.input)
      return;

    this.printDevice('Disconnecting');

    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    this.#device.disconnect();
    this.#token = null;
    this.#clear();

    for (const notifier of this.#notifiers.reset)
      notifier();

    this.#select.focus();
    window.scroll(0, 0);
  }

  disconnect() {
    this.#disconnectDevice();
    this.#select.setDisconnected();
  }

  sendReset() {
    this.sendSystemReset();
    this.sendGetAll();
  }

  sendReboot() {
    this.printDevice('Calling <b>reboot()</>');
    this.sendRequest({
      'method': 'reboot'
    });
    this.disconnect();
  }

  // Reboot the device and temporarily create MIDI ports/virtual
  // cables to access children devices. The device can describe itself
  // how many children devices are expected to be connected.
  rebootWithPorts() {
    let ports = this.#data.system.ports.announce;

    // Ports enabled but no custom number of ports specified, use the maximum.
    if (ports == 1)
      ports = 16;

    this.printDevice('Calling <b>reboot()</>');
    this.sendRequest({
      'method': 'reboot',
      'reboot': {
        'ports': ports
      }
    });
    this.disconnect();
  }

  sendNote(channel, note, velocity) {
    this.#device.sendNote(channel, note, velocity);
    this.print('Sending <b>Note</b> <i>' +
      V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
  }

  sendNoteOff(channel, note, velocity = 64) {
    this.#device.sendNoteOff(channel, note, velocity);
    this.print('Sending <b>NoteOff</b> <i>' +
      V2MIDI.Note.name(note) + '(' + note + ')</i> with velocity <i>' + velocity + '</i> on channel #' + (channel + 1));
  }

  sendControlChange(channel, controller, value) {
    this.#device.sendControlChange(channel, controller, value);
    this.print('Sending <b>Control Change</b> <i>#' + controller +
      '</i> with value <i>' + value + '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendProgramChange(channel, value) {
    this.#device.sendProgramChange(channel, value);
    this.print('Sending <b>Program Change</b> <i>#' + (value + 1) +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendAftertouchChannel(channel, value) {
    this.#device.sendAftertouchChannel(channel, value);
    this.print('Sending <b>Aftertouch Channel</b> <i>#' + value +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendPitchBend(channel, value) {
    this.#device.sendPitchBend(channel, value);
    this.print('Sending <b>Pitch Bend</b> <i>#' + value +
      '</i> on channel <i>#' + (channel + 1) + '</i>');
  }

  sendSystemReset() {
    this.#device.sendSystemReset();
    this.print('Sending <b>SystemReset</b>');
  }

  sendSystemExclusive(message) {
    const length = this.#device.sendSystemExclusive(message);
    this.printDevice('Sending <b>SystemExclusive</b> length=' + length);
  }

  #show(data) {
    this.#data = data;

    if (!this.#tabs) {
      new V2WebTabs(this.canvas, (tabs, element) => {
        this.#tabs = tabs;
        element.classList.add('mt-4');

        tabs.addTab('information', 'Information', (e) => {
          this.#info = e;
        });

        tabs.addTab('details', 'Details', (e) => {
          this.#details = e;
        });

        tabs.addTab('update', 'Update', (e) => {
          this.#update.element = e;
        });

        // Check for firmware updates when activating the tab.
        tabs.addNotifier((name) => {
          if (name == 'update')
            this.#loadFirmwareIndex();
        });
      });

    } else {
      this.#tabs.resetTab('information');
      this.#tabs.resetTab('details');
      this.#tabs.resetTab('update');
    }

    // The Information tab.
    V2Web.addElement(this.#info, 'div', (container) => {
      container.classList.add('table-container');

      V2Web.addElement(container, 'table', (e) => {
        e.classList.add('table');
        e.classList.add('is-fullwidth');
        e.classList.add('is-striped');
        e.classList.add('is-narrow');

        V2Web.addElement(e, 'tbody', (body) => {
          for (const key of Object.keys(data.metadata)) {
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const value = data.metadata[key];

            V2Web.addElement(body, 'tr', (row) => {
              V2Web.addElement(row, 'td', (e) => {
                e.textContent = name;
              });

              V2Web.addElement(row, 'td', (e) => {
                if (typeof value == 'string' && value.match(/^https?:\/\//)) {
                  V2Web.addElement(e, 'a', (a) => {
                    a.href = value;
                    a.target = 'home';
                    a.textContent = value.replace(/^https?:\/\//, '');
                  });
                } else
                  e.textContent = value;
              });
            });
          }
        });
      });
    });

    // The Details tab.
    V2Web.addButtons(this.#details, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.classList.add('is-link');
        e.textContent = 'Refresh';
        e.addEventListener('click', () => {
          this.sendGetAll();
        });
      });
    });

    V2Web.addElement(this.#details, 'div', (container) => {
      container.classList.add('table-container');

      V2Web.addElement(container, 'table', (e) => {
        e.classList.add('table');
        e.classList.add('is-fullwidth');
        e.classList.add('is-striped');
        e.classList.add('is-narrow');

        V2Web.addElement(e, 'tbody', (body) => {
          const printObject = (parent, object) => {
            for (const key of Object.keys(object)) {
              let name = key;
              if (parent)
                name = parent + '.' + name;

              const value = object[key];
              if (typeof value == 'object') {
                printObject(name, value);

              } else {
                V2Web.addElement(body, 'tr', (row) => {

                  V2Web.addElement(row, 'td', (e) => {
                    e.textContent = name;
                  });

                  V2Web.addElement(row, 'td', (e) => {
                    e.textContent = value;
                  });
                });
              }
            }
          }
          printObject(null, data.system);

        });
      });
    });

    // The Update tab.
    V2Web.addButtons(this.#update.element, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Access Ports';
        if (!data.system.ports || data.system.ports.announce == 0)
          e.disabled = true;
        e.addEventListener('click', () => {
          this.rebootWithPorts();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Load';
        e.addEventListener('click', () => {
          this.#openFirmware();
        });

        V2Web.addFileDrop(e, this.#update.element, ['is-focused', 'is-link', 'is-light'], (file) => {
          this.#readFirmware(file);
        });
      });

      V2Web.addButton(buttons, (e) => {
        this.#update.elementUpload = e;
        e.classList.add('is-link');
        e.disabled = true;
        e.textContent = 'Install';
        e.addEventListener('click', () => {
          this.#uploadFirmware();
        });
      });
    });

    V2Web.addElement(this.#update.element, 'progress', (e) => {
      this.#update.elementProgress = e;
      e.style.display = 'none';
      e.classList.add('progress');
      e.classList.add('is-small');
      e.value = 0;
    });

    this.#update.notify = new V2WebNotify(this.#update.element);

    V2Web.addElement(this.#update.element, 'div', (e) => {
      this.#update.elementSelect = e;
      e.classList.add('mb-5');
    });

    V2Web.addElement(this.#update.element, 'div', (e) => {
      this.#update.elementNewFirmware = e;
    });

    if (!this.#tabs.current)
      this.#tabs.switchTab('information');
  }

  #clear() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }

    if (!this.#data)
      return;

    this.#data = null;
    this.#tabs.remove();
    this.#tabs = null;
    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;
  }

  // Process the com.versioduo.device message reply message.
  #handleReply(data) {
    this.printDevice('Received <b>com.versioduo.device<b> message');

    // Remember the token from the first reply.
    if (!this.#token && data['token'])
      this.#token = data['token'];

    if (this.#token != data['token']) {
      this.printDevice('Wrong token, ignoring message');
      return;
    }

    if (data.firmware && data.firmware.status) {
      this.#uploadFirmwareBlock(data.firmware.status);
      return;
    }

    if (!data.metadata) {
      this.printDevice('Missing device information');
      this.disconnect();
      return;
    }

    // If this is the first reply, update the interface;
    if (!this.#data) {
      this.printDevice('Device is connected');
      this.#select.setConnected();
    }

    this.#show(data);

    // Detach the Log section and attach it again after all other sections.
    this.#log.detach();

    for (const notifier of this.#notifiers.show)
      notifier(data);

    this.#log.attach();
  }

  // Connect or switch to a device.
  connect(device) {
    if (this.#version)
      this.#version.remove();

    this.#disconnectDevice();

    // Give this connection attempt a #sequence number, so we can 'cancel'
    // the promise which might be resolved later, when a new connection
    // attempt is already submitted from the user interface.
    this.#sequence++;
    let sequence = this.#sequence;

    // Try to open the input device.
    device.in.open().then(() => {
      if (sequence != this.#sequence)
        return;

      // We got the input, try to open the corresponding output device.
      device.out.open().then(() => {
        if (sequence != this.#sequence)
          return;

        // We have input and output.
        this.#device.input = device.in;
        this.#device.output = device.out;

        // Dispatch incoming messages to V2MIDIDevice.
        this.#device.input.onmidimessage = this.#device.handleMessage.bind(this.#device);

        // Request information from device.
        this.printDevice('Device is ready');
        this.sendGetAll();
      });
    });

    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#log.print('Unable to connect to device <b>' + device.name + '</b>');
      this.disconnect();
    }, 2000);

    this.#select.setConnecting();
  }

  // Load 'index.json' and from the 'download' URL and check if there is a firmware update available.
  #loadFirmwareIndex() {
    if (!this.#data.system || !this.#data.system.firmware.download)
      return;

    if (this.#update.firmware.bytes)
      return;

    this.printDevice('Requesting firmware information: <b>' + this.#data.system.firmware.download + '/index.json</b>');

    fetch(this.#data.system.firmware.download + '/index.json', {
        cache: 'no-cache'
      })
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.json();
      })
      .then((json) => {
        this.printDevice('Retrieved firmware update index');

        let updates = json[this.#data.system.firmware.id];
        if (!updates) {
          this.#update.notify.warn('No firmware update found for this device.');
          this.printDevice('No firmware update found for this device.');
          return;
        }

        updates = updates.filter((update) => {
          return update.board == this.#data.system.board;
        });

        if (updates.length == 0) {
          this.#update.notify.warn('No firmware update found for this board.');
          this.printDevice('No firmware update found for this board.');
          return;
        }

        // Find the largest version number.
        updates.sort((a, b) => {
          return b.version - a.version;
        });

        if (this.#data.system.firmware.version > updates[0].version)
          this.#update.notify.warn('A more recent firmware is already installed.');

        while (this.#update.elementSelect.firstChild)
          this.#update.elementSelect.firstChild.remove();

        V2Web.addElement(this.#update.elementSelect, 'p', (e) => {
          e.classList.add('title');
          e.classList.add('subsection');
          e.textContent = 'Firmware Update';
        });

        new V2WebField(this.#update.elementSelect, (field) => {
          field.addButton((e) => {
            e.classList.add('width-label');
            e.classList.add('has-background-grey-lighter');
            e.classList.add('inactive');
            e.textContent = 'Version';
            e.tabIndex = -1;
          });

          field.addElement('span', (e) => {
            e.classList.add('select');

            V2Web.addElement(e, 'select', (select) => {
              if (updates.length == 1)
                select.disabled = true;

              for (let i = 0; i < updates.length; i++) {
                V2Web.addElement(select, 'option', (e) => {
                  e.value = i;
                  e.text = updates[i].version;
                });
              }

              select.addEventListener('change', () => {
                this.#loadFirmware(this.#data.system.firmware.download + '/' + updates[select.value].file);
              });
            });
          });
        });

        if (this.#data.system.firmware.hash == updates[0].hash)
          this.#update.notify.success('The firmware is up-to-date.');

        else
          this.#loadFirmware(this.#data.system.firmware.download + '/' + updates[0].file);

      })
      .catch((error) => {
        this.printDevice('Error requesting firmware information: ' + error.message);
      })
  }

  #loadFirmware(filename) {
    this.printDevice('Requesting firmware image: <b>' + filename + '</b>');

    fetch(filename, {
        cache: 'no-cache'
      })
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.arrayBuffer();
      })
      .then((buffer) => {
        this.printDevice('Retrieved firmware image, length=' + buffer.byteLength);
        this.#showFirmware(new Uint8Array(buffer));
      })
      .catch((error) => {
        this.printDevice('Error requesting firmware image: ' + error.message);
      })
  }

  #readFirmware(file) {
    const reader = new FileReader();
    reader.onload = (element) => {
      this.#showFirmware(new Uint8Array(reader.result));
    }

    reader.readAsArrayBuffer(file);
  }

  // Load a firmware image from the local disk.
  #openFirmware() {
    this.#update.firmware.bytes = null;
    this.#update.firmware.hash = null;

    // Temporarily create a hidden 'browse button' and trigger a file upload.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin';

    input.addEventListener('change', () => {
      this.#readFirmware(input.files[0]);
    }, false);

    input.click();
  }

  // Present a new firmware image to update the current one.
  #showFirmware(bytes) {
    this.#update.notify.clear();
    while (this.#update.elementNewFirmware.firstChild)
      this.#update.elementNewFirmware.firstChild.remove();

    // Read the metadata in the image; the very end of the image contains
    // the the JSON metadata record with a leading and trailing NUL character.
    let metaStart = bytes.length - 2;
    while (bytes[metaStart] != 0) {
      metaStart--;
      if (metaStart < 4) {
        this.#update.notify.warn('Unknown file type. No valid device metadata found.');
        return;
      }
    }

    const metaBytes = bytes.slice(metaStart + 1, bytes.length - 1);
    const metaString = new TextDecoder().decode(metaBytes);

    let meta;
    try {
      meta = JSON.parse(metaString);

    } catch (error) {
      this.#update.notify.warn('Unknown file type. Unable to parse metadata.');
      return;
    }

    const firmware = meta['com.versioduo.firmware'];
    if (!firmware) {
      this.#update.notify.warn('Unknown file type. Missing metadata.');
      return;
    }

    // We found metadata in the loaded image.
    this.#update.firmware.bytes = bytes;

    let elementHash = null;

    V2Web.addElement(this.#update.elementNewFirmware, 'div', (e) => {
      e.classList.add('table-container');

      V2Web.addElement(e, 'table', (table) => {
        table.classList.add('table');
        table.classList.add('is-fullwidth');
        table.classList.add('is-striped');
        table.classList.add('is-narrow');

        V2Web.addElement(table, 'tbody', (body) => {
          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Version';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = firmware.version;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Id';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = firmware.id;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Board';
            });
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = firmware.board;
            });
          });

          V2Web.addElement(body, 'tr', (row) => {
            V2Web.addElement(row, 'td', (e) => {
              e.textContent = 'Hash';
            });
            V2Web.addElement(row, 'td', (e) => {
              elementHash = e;
            });
          });
        });
      });
    });

    crypto.subtle.digest('SHA-1', this.#update.firmware.bytes).then((hash) => {
      const array = Array.from(new Uint8Array(hash));
      const hex = array.map((b) => {
        return b.toString(16).padStart(2, '0');
      }).join('');
      this.#update.firmware.hash = hex;
      elementHash.textContent = hex;
      const backup = this.#data.system.eeprom.used > 0 ? ' Please backup the configuration before the installation.' : '';

      if (this.#data.system.board && firmware.board != this.#data.system.board)
        this.#update.notify.error('The firmware update is for a different board which has the name <b>' + firmware.board + '</>.');

      else if (firmware.id != this.#data.system.firmware.id)
        this.#update.notify.warn('The firmware update appears to provide a different functionality, it has the name <b>' + firmware.id + '</>.');

      else if (firmware.version < this.#data.metadata.version)
        this.#update.notify.warn('The firmware is older than the currently installed version.' + backup);

      else if (this.#update.firmware.hash == this.#data.system.firmware.hash)
        this.#update.notify.info('This firmware is currently installed.');

      else
        this.#update.notify.info('A firmware update is available.' + backup);

      this.#update.elementUpload.disabled = false;
    });
  }

  // Transfer the loded image to the device.
  #uploadFirmware() {
    this.#update.elementProgress.value = 0;
    this.#update.elementProgress.max = this.#update.firmware.bytes.length;
    this.#update.elementProgress.style.display = '';

    // Send the first block; the reply messages will trigger the remaining blocks.
    this.#update.firmware.current = 0;
    this.#uploadFirmwareBlock();
  }

  // Send one block of our firmware image. This will be called from
  // the incoming message handler, when the previous block was sucessfully written.
  #uploadFirmwareBlock(status) {
    if (status) {
      switch (status) {
        case 'success':
          break;

        case 'hashMismatch':
          this.#update.notify.error('Error while verifying the transferred firmware.');
          return;

        case 'invalidOffset':
          this.#update.notify.error('Invalid parameters for firmware update.');
          return;

        default:
          this.#update.notify.error('Error while updating the firmware: ' + status);
          return;
      }
    }

    // The last update packet was successful. If the device is connected
    // over USB we will notice the automatic reboot, we will not detect the reboot
    // of a children device, so disconnect it here.
    if (this.#update.firmware.current == null) {
      this.printDevice('Firmware update successful. Disconnecting device');
      this.disconnect();
      return;
    }

    const offset = this.#update.firmware.current;
    // The block size is fixed to 8k. Daisy-chained devices might not be able to forward larger packets.
    const block = this.#update.firmware.bytes.slice(offset, offset + 0x2000);
    const data = btoa(String.fromCharCode.apply(null, block));
    let request = {
      'method': 'writeFirmware',
      'firmware': {
        'offset': offset,
        'data': data
      }
    };

    if (this.#update.firmware.current + 0x2000 <= this.#update.firmware.bytes.length) {
      // Prepare for next block.
      this.#update.elementProgress.value = offset;
      this.#update.firmware.current += 0x2000;

    } else {
      // Last block.
      this.#update.elementProgress.value = this.#update.firmware.bytes.length;
      this.#update.firmware.current = null;

      // Add our hash to the request; if the device has received
      // the correct image it copies it over and reboots.
      this.printDevice('Firmware submitted. Requesting device update with hash <b>' + this.#update.firmware.hash + '</b>');
      request.firmware.hash = this.#update.firmware.hash;
    }

    this.sendRequest(request);
  }
}
