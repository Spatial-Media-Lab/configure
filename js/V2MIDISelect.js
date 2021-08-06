// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

class V2MIDISelect {
  #element = null;
  #select = null;
  #notifiers = Object.seal({
    select: [],
    disconnect: [],
    add: []
  });
  #devices = null;

  constructor(canvas, handler) {
    V2Web.addElement(canvas, 'div', (e) => {
      this.#element = e;
      e.classList.add('select');
      e.classList.add('mb-4');

      V2Web.addElement(e, 'select', (select) => {
        this.#select = select;
        select.title = 'Select the MIDI device to connect to';
        select.disabled = true;
        select.addEventListener('change', () => {
          if (select.value == '') {
            for (const notifier of this.#notifiers.select)
              notifier(null);

          } else {
            for (const notifier of this.#notifiers.select)
              notifier(this.#devices.get(select.value));
          }
        });

        V2Web.addElement(select, 'option', (e) => {
          e.textContent = 'Connect to ...';
          e.value = '';
        });
      });

      if (handler)
        handler(e);
    });
  }

  update(devices) {
    this.#devices = devices;
    let add = false;

    // Delete the option/entry for no longer existing devices. Create a shallow
    // copy to iterate over, we delete elements from the list.
    Array.from(this.#select.options, (option) => {
      if (option.value == '')
        return;

      if (!devices.has(option.value)) {
        if (option.selected)
          for (const notifier of this.#notifiers.disconnect)
            notifier();

        option.remove();
      }
    });

    // Insert all new devices.
    let after = this.#select.options[0];
    for (const [id, device] of devices) {
      // Find the index of the existing entry.
      const index = Array.from(this.#select.options).findIndex((option) => {
        return option.value == id;
      });

      // Skip the existing entry, but remember the index to insert the next new entry after.
      if (index > 0) {
        after = this.#select.options[index];
        continue;
      }

      add = true;

      V2Web.addElementAfter(after, 'option', (e) => {
        after = e;
        e.value = id;
        e.text = device.name;
      });
    }

    this.#select.disabled = this.#select.options.length == 1;

    if (add)
      for (const notifier of this.#notifiers.add)
        notifier();
  }

  getDevices() {
    return this.#devices || new Map();
  }

  select(device) {
    for (const option of this.#select.options) {
      if (option.value != device.id)
        continue;

      option.selected = true;
      break;
    }
  }

  setConnecting() {
    this.#element.classList.add('is-loading');
  }

  setConnected() {
    this.#element.classList.remove('is-loading');
    this.#select.options[0].text = 'Disconnect ...';
  }

  setDisconnected() {
    this.#select.options[0].text = 'Connect to ...';
    this.#select.selectedIndex = 0;
    this.#element.classList.remove('is-loading');
  }

  focus() {
    this.#select.focus();
  }

  addNotifier(type, handler) {
    this.#notifiers[type].push(handler);
  }

  remove() {
    this.#devices = null;
    this.#element.remove();
  }
}