// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// Show HTML formatted log messages.
class V2Log extends V2WebModule {
  #device = null;
  #element = null;
  #lines = [];
  #refresh = false;
  #timeout = null;

  // Early initialization to store messages before the section is added.
  constructor() {
    super('log', 'Log', 'View system events');

    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Status';
        e.addEventListener('click', () => {
          this.#device.printStatus();
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Clear';
        e.addEventListener('click', () => {
          this.#clear();
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#element = e;
      e.classList.add('log');
      e.classList.add('content');
      e.classList.add('is-small');
    });

    return Object.seal(this);
  }

  print(line) {
    this.#lines.push(line);
    if (this.#lines.length > 25)
      this.#lines.shift();

    this.#refresh = true;

    if (this.#timeout)
      return;

    this.#update();

    // Set timout to rate-limit the updating.
    this.#timeout = setTimeout(() => {
      this.#timeout = null;
      this.#update();
    }, 250);
  }

  setup(device) {
    this.#device = device;
  }

  #update() {
    if (!this.#refresh)
      return;

    this.#refresh = false;

    this.#element.innerHTML = '';
    for (const line of this.#lines)
      this.#element.innerHTML += line + '<br>\n';

    this.#element.scrollTop = this.#element.scrollHeight;
  }

  #clear() {
    this.#lines = [];
    this.#element.innerHTML = '';
  }
}
