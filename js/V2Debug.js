// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// Debug interface
class V2Debug extends V2WebModule {
  #device = null;
  #element = null;

  constructor(device) {
    super('debug', 'Debug', 'Show the last reply');
    super.attach();
    this.#device = device;

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.textContent = 'Copy';
        e.title = 'Copy to clipboard';
        e.addEventListener('click', () => {
          navigator.clipboard.writeText(this.#element.textContent);
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      V2Web.addElement(e, 'pre', (pre) => {
        this.#element = pre;
        pre.classList.add('has-background-white');
      });
    });

    this.#device.addNotifier('show', (data) => {
      this.#element.textContent = '"com.versioduo.device": ' + JSON.stringify(data, null, '  ');
    });

    this.#device.addNotifier('reset', (data) => {
      this.#element.textContent = '';
    });
  }
}
